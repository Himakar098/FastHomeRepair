// scripts/index-products.js
const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const { CosmosClient } = require('@azure/cosmos');

const searchClient = new SearchClient(
  process.env.SEARCH_ENDPOINT,
  'products-index',
  new AzureKeyCredential(process.env.SEARCH_API_KEY)
);

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database('homerepair-db');
const container = database.container('products');

async function indexProducts() {
  console.log('Indexing products in Azure Search...');
  
  try {
    // Get all products from Cosmos DB
    const { resources: products } = await container.items.readAll().fetchAll();
    
    // Transform products for search index
    const searchDocuments = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      supplier: product.supplier,
      location: product.location || 'Perth',
      problems: product.applicableProblems || [],
      inStock: product.inStock !== false,
      rating: product.rating || 0,
      lastUpdated: new Date().toISOString()
    }));
    
    // Upload documents to search index
    const uploadResult = await searchClient.uploadDocuments(searchDocuments);
    
    console.log(`Indexed ${uploadResult.results.length} products`);
    
    // Check for any failures
    const failures = uploadResult.results.filter(result => !result.succeeded);
    if (failures.length > 0) {
      console.error('Some products failed to index:', failures);
    }
    
  } catch (error) {
    console.error('Error indexing products:', error);
  }
}

indexProducts().catch(console.error);