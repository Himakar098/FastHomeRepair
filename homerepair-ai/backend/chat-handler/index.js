const { CosmosClient } = require('@azure/cosmos');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database('homerepair-db');

const requiredOpenAIEnv = [
  'OPENAI_API_KEY',
  'OPENAI_API_BASE',
  'OPENAI_DEPLOYMENT_NAME',
  'OPENAI_API_VERSION'
];

for (const variable of requiredOpenAIEnv) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: `${process.env.OPENAI_API_BASE}/openai/deployments/${process.env.OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': process.env.OPENAI_API_VERSION },
  defaultHeaders: { 'api-key': process.env.OPENAI_API_KEY }
});

module.exports = async function (context, req) {
  context.log('Chat handler triggered');
  
  try {
    const { message, conversationId, userId, images } = req.body;
    
    // Validate input
    if (!message || !userId) {
      context.res = {
        status: 400,
        body: { error: 'Message and userId are required' }
      };
      return;
    }

    // Get or create conversation
    const convId = conversationId || uuidv4();
    const conversation = await getOrCreateConversation(convId, userId);

    // Add user message to conversation
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      images: images || []
    };
    
    conversation.messages.push(userMessage);

    // Prepare AI prompt with context
    const systemPrompt = `You are a Perth-based home repair expert AI assistant. 
    
    Your role is to:
    1. Analyze home repair problems from descriptions and images
    2. Determine if the issue can be DIY or needs professional help
    3. Recommend specific products available at Bunnings or other Perth suppliers
    4. Provide step-by-step guidance for DIY repairs
    5. Suggest local tradies when professional help is needed
    6. Estimate costs in Australian dollars
    7. Consider Perth's climate and building regulations
    
    Always prioritize safety and be clear about difficulty levels. For rental properties, advise on landlord/tenant responsibilities.
    
    Format your response with:
    - Problem diagnosis
    - Difficulty assessment (Easy/Medium/Hard/Professional Required)
    - Required materials/tools with Perth suppliers
    - Step-by-step instructions (if DIY appropriate)
    - Cost estimate
    - Safety warnings
    - When to call professionals`;

    // Create messages array for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.slice(-5) // Last 5 messages for context
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    // Add AI response to conversation
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(assistantMessage);

    // Save conversation
    await saveConversation(conversation);

    // Extract structured data from response (products, professionals, etc.)
    const structuredResponse = await parseAIResponse(aiResponse);

    context.res = {
      status: 200,
      body: {
        response: aiResponse,
        conversationId: convId,
        ...structuredResponse
      }
    };

  } catch (error) {
    context.log.error('Chat handler error:', error);
    context.res = {
      status: 500,
      body: { error: 'Internal server error' }
    };
  }
};

async function getOrCreateConversation(conversationId, userId) {
  const container = database.container('conversations');
  
  try {
    const { resource } = await container.item(conversationId, userId).read();
    return resource;
  } catch (error) {
    // Create new conversation
    return {
      id: conversationId,
      userId: userId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

async function saveConversation(conversation) {
  const container = database.container('conversations');
  conversation.updatedAt = new Date().toISOString();
  await container.items.upsert(conversation);
}

async function parseAIResponse(response) {
  // Extract products, professionals, costs from AI response
  // This is a simplified version - you'd implement more sophisticated parsing
  const products = [];
  const professionals = [];
  
  // Look for product mentions (Bunnings items, etc.)
  const productRegex = /(?:bunnings|purchase|buy).*?([A-Z][a-z\s]+)/gi;
  const productMatches = response.match(productRegex);
  
  if (productMatches) {
    // Query product database for matches
    // Implementation depends on your product catalog structure
  }
  
  return {
    products,
    professionals,
    estimatedCost: extractCostEstimate(response),
    difficultyLevel: extractDifficulty(response)
  };
}

function extractCostEstimate(response) {
  const costRegex = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
  const costs = response.match(costRegex);
  return costs ? costs[0] : null;
}

function extractDifficulty(response) {
  const difficultyRegex = /(easy|medium|hard|professional)/gi;
  const match = response.match(difficultyRegex);
  return match ? match[0].toLowerCase() : 'unknown';
}