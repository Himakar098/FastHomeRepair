const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const { CosmosClient } = require('@azure/cosmos');

const searchClient = new SearchClient(
  process.env.SEARCH_ENDPOINT,
  'products-index',
  new AzureKeyCredential(process.env.SEARCH_API_KEY)
);

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database('homerepair-db');

module.exports = async function (context, req) {
  try {
    const { problem, category, maxPrice, location = 'Perth' } = req.body;
    
    if (!problem) {
      context.res = {
        status: 400,
        body: { error: 'Problem description required' }
      };
      return;
    }

    // Search for relevant products
    const searchResults = await searchProducts(problem, category, maxPrice, location);
    
    // Get detailed product information from Cosmos DB
    const detailedProducts = await getProductDetails(searchResults);
    
    // Find relevant professionals
    const professionals = await findProfessionals(problem, location);

    context.res = {
      status: 200,
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
      body: { error: 'Product search failed' }
    };
  }
};

async function searchProducts(problem, category, maxPrice, location) {
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

async function getProductDetails(searchResults) {
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

async function findProfessionals(problem, location) {
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