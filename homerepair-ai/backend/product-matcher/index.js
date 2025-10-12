const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const { CosmosClient } = require('@azure/cosmos');

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const missingSearchEnv = ['SEARCH_ENDPOINT', 'SEARCH_API_KEY'].filter(name => !process.env[name]);
let searchClient = null;
if (missingSearchEnv.length === 0) {
  searchClient = new SearchClient(
    process.env.SEARCH_ENDPOINT,
    'products-index',
    new AzureKeyCredential(process.env.SEARCH_API_KEY)
  );
}

let database = null;
if (process.env.COSMOS_CONNECTION_STRING) {
  const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
  database = cosmosClient.database('homerepair-db');
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
    if (missingSearchEnv.length > 0) {
      const details = `Missing required environment variables: ${missingSearchEnv.join(', ')}`;
      context.log.error(details);
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: { error: 'Product search not configured', details }
      };
      return;
    }

    if (!database) {
      const details = 'Missing required environment variable: COSMOS_CONNECTION_STRING';
      context.log.error(details);
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: { error: 'Product search not configured', details }
      };
      return;
    }

    const { problem, category, maxPrice, location = 'Perth' } = req.body;
    
    if (!problem) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: 'Problem description required' }
      };
      return;
    }

    // Search for relevant products
    const searchResults = await searchProducts(searchClient, problem, category, maxPrice, location);
    
    // Get detailed product information from Cosmos DB
    const detailedProducts = await getProductDetails(database, searchResults);
    
    // Find relevant professionals
    const professionals = await findProfessionals(database, problem, location);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: {
        products: detailedProducts,
        professionals,
        searchQuery: problem,
        totalResults: searchResults.length
      }
    };

  } catch (error) {
    context.log.error('Product matching error:', error);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: 'Product search failed' }
    };
  }
};

async function searchProducts(searchClient, problem, category, maxPrice, location) {
  const searchOptions = {
    searchFields: ['name', 'description', 'problems'],
    select: ['id', 'name', 'price', 'supplier', 'category'],
    top: 10,
    filter: []
  };
  
  // Add filters
  if (category) {
    searchOptions.filter.push(`category eq '${category}'`);
  }
  
  if (maxPrice) {
    searchOptions.filter.push(`price le ${maxPrice}`);
  }
  
  searchOptions.filter.push(`location eq '${location}'`);
  
  if (searchOptions.filter.length > 0) {
    searchOptions.filter = searchOptions.filter.join(' and ');
  } else {
    delete searchOptions.filter;
  }
  
  const searchResults = await searchClient.search(problem, searchOptions);
  const results = [];
  for await (const result of searchResults) {
    results.push({
      id: result.document.id,
      name: result.document.name,
      price: result.document.price,
      supplier: result.document.supplier,
      category: result.document.category,
      score: result.score
    });
  }
  
  return results;
}

async function getProductDetails(database, searchResults) {
  const container = database.container('products');
  const detailedProducts = [];
  
  for (const result of searchResults) {
    try {
      const { resource } = await container.item(result.id, result.category).read();
      detailedProducts.push({
        ...resource,
        searchScore: result.score
      });
    } catch (error) {
      // Product not found in detail database, use search result
      detailedProducts.push(result);
    }
  }
  
  return detailedProducts;
}

async function findProfessionals(database, problem, location) {
  const container = database.container('professionals');
  
  // Simple query - in production, you'd use more sophisticated matching
  const querySpec = {
    query: 'SELECT * FROM c WHERE CONTAINS(c.services, @problem) AND ARRAY_CONTAINS(c.serviceAreas, @location)',
    parameters: [
      { name: '@problem', value: extractServiceType(problem) },
      { name: '@location', value: location }
    ]
  };
  
  const { resources } = await container.items.query(querySpec).fetchAll();
  
  return resources.slice(0, 5); // Return top 5 professionals
}

function extractServiceType(problem) {
  const serviceMap = {
    'plumbing': ['leak', 'pipe', 'tap', 'water', 'drain'],
    'electrical': ['wiring', 'power', 'light', 'switch', 'outlet'],
    'carpentry': ['door', 'window', 'cabinet', 'shelf', 'wood'],
    'painting': ['paint', 'wall', 'ceiling', 'color'],
    'general_maintenance': ['repair', 'fix', 'maintenance', 'broken']
  };
  
  const problemLower = problem.toLowerCase();
  
  for (const [service, keywords] of Object.entries(serviceMap)) {
    if (keywords.some(keyword => problemLower.includes(keyword))) {
      return service;
    }
  }
  
  return 'general_maintenance';
}