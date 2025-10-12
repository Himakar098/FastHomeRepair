const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-azure-js');
const { BlobServiceClient } = require('@azure/storage-blob');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const missingVisionEnv = ['COMPUTER_VISION_KEY', 'COMPUTER_VISION_ENDPOINT'].filter(
  name => !process.env[name]
);
let computerVisionClient = null;
if (missingVisionEnv.length === 0) {
  computerVisionClient = new ComputerVisionClient(
    new ApiKeyCredentials({
      inHeader: { 'Ocp-Apim-Subscription-Key': process.env.COMPUTER_VISION_KEY }
    }),
    process.env.COMPUTER_VISION_ENDPOINT
  );
}

let blobServiceClient = null;
if (process.env.BLOB_STORAGE_CONNECTION_STRING) {
  blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.BLOB_STORAGE_CONNECTION_STRING
  );
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: corsHeaders
    };
    return;
  }

  try {
    if (missingVisionEnv.length > 0) {
      const details = `Missing required environment variables: ${missingVisionEnv.join(', ')}`;
      context.log.error(details);
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: { error: 'Image analysis not configured', details }
      };
      return;
    }

    if (!blobServiceClient) {
      const details = 'Missing required environment variable: BLOB_STORAGE_CONNECTION_STRING';
      context.log.error(details);
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: { error: 'Image analysis not configured', details }
      };
      return;
    }
    const { imageData, imageUrl, problemContext } = req.body;
    
    let analyzableUrl = imageUrl;
    
    // If base64 image data provided, upload to blob storage first
    if (imageData && !imageUrl) {
      analyzableUrl = await uploadImageToBlob(imageData, context);
    }
    
    if (!analyzableUrl) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: 'Image URL or image data required' }
      };
      return;
    }

    // Analyze image with Computer Vision
    const analysis = await computerVisionClient.analyzeImage(analyzableUrl, {
      visualFeatures: [
        'Categories',
        'Description',
        'Objects',
        'Tags',
        'Faces',
        'Adult',
        'Color'
      ],
      details: ['Landmarks']
    });

    // Extract relevant information for home repairs
    const repairAnalysis = processImageForRepairs(analysis, problemContext);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        imageUrl: analyzableUrl,
        analysis: repairAnalysis,
        rawAnalysis: analysis
      }
    };

  } catch (error) {
    context.log.error('Image analysis error:', error);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: 'Image analysis failed' }
    };
  }
};

async function uploadImageToBlob(base64Data, context) {
  try {
    const containerName = 'repair-images';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'blob' });
    
    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data.split(',')[1], 'base64');
    
    // Upload blob
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' }
    });
    
    return blockBlobClient.url;
    
  } catch (error) {
    context.log.error('Blob upload error:', error);
    throw error;
  }
}

function processImageForRepairs(analysis, problemContext) {
  const repairKeywords = [
    'damage', 'crack', 'hole', 'stain', 'leak', 'broken', 'rust', 'mold',
    'paint', 'wall', 'ceiling', 'floor', 'door', 'window', 'kitchen', 'bathroom'
  ];
  
  // Extract relevant tags and descriptions
  const relevantTags = analysis.tags.filter(tag => 
    repairKeywords.some(keyword => 
      tag.name.toLowerCase().includes(keyword) ||
      keyword.includes(tag.name.toLowerCase())
    )
  );
  
  // Analyze description for repair context
  const description = analysis.description.captions[0]?.text || '';
  const confidence = analysis.description.captions[0]?.confidence || 0;
  
  return {
    description,
    confidence,
    relevantTags: relevantTags.map(tag => ({
      name: tag.name,
      confidence: tag.confidence
    })),
    detectedObjects: analysis.objects.map(obj => ({
      object: obj.objectProperty,
      confidence: obj.confidence,
      rectangle: obj.rectangle
    })),
    repairSuggestions: generateRepairSuggestions(relevantTags, description, problemContext)
  };
}

function generateRepairSuggestions(tags, description, context) {
  const suggestions = [];
  
  // Basic pattern matching for common issues
  if (tags.some(tag => tag.name.includes('crack'))) {
    suggestions.push({
      issue: 'Visible cracks detected',
      urgency: 'medium',
      action: 'Assess crack size and location for appropriate repair method'
    });
  }
  
  if (tags.some(tag => tag.name.includes('stain'))) {
    suggestions.push({
      issue: 'Staining visible',
      urgency: 'low',
      action: 'Identify stain type and select appropriate cleaning solution'
    });
  }
  
  // Add more pattern matching based on common repair scenarios
  
  return suggestions;
}