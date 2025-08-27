// scripts/seed-products.js
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database('homerepair-db');
const container = database.container('products');

const sampleProducts = [
  {
    id: 'bunnings_001',
    name: 'Easy Off Oven Cleaner 300ml',
    description: 'Heavy-duty oven cleaner for removing burnt-on grease and food residue',
    category: 'cleaning',
    price: 12.50,
    supplier: 'Bunnings',
    location: 'Perth',
    applicableProblems: ['oven_stains', 'grease_buildup', 'burnt_food'],
    productUrl: 'https://www.bunnings.com.au/easy-off-oven-cleaner',
    imageUrl: 'https://bunnings.imgix.net/products/easy-off-oven-cleaner.jpg',
    inStock: true,
    rating: 4.3,
    reviewCount: 127
  },
  {
    id: 'bunnings_002',
    name: 'Polyfilla Ready Mixed Wall Filler 330g',
    description: 'Ready-to-use wall filler for cracks and holes up to 20mm deep',
    category: 'wall_repair',
    price: 8.90,
    supplier: 'Bunnings',
    location: 'Perth',
    applicableProblems: ['wall_holes', 'cracks', 'nail_holes', 'wall_damage'],
    productUrl: 'https://www.bunnings.com.au/polyfilla-wall-filler',
    imageUrl: 'https://bunnings.imgix.net/products/polyfilla-wall-filler.jpg',
    inStock: true,
    rating: 4.5,
    reviewCount: 89
  },
  {
    id: 'bunnings_003',
    name: 'Selleys Kwik Grip Contact Adhesive 75ml',
    description: 'Strong contact adhesive for laminate repairs and loose edges',
    category: 'adhesives',
    price: 7.60,
    supplier: 'Bunnings',
    location: 'Perth',
    applicableProblems: ['loose_laminate', 'benchtop_repair', 'edge_lifting'],
    productUrl: 'https://www.bunnings.com.au/selleys-kwik-grip',
    imageUrl: 'https://bunnings.imgix.net/products/selleys-kwik-grip.jpg',
    inStock: true,
    rating: 4.2,
    reviewCount: 156
  },
  {
    id: 'bunnings_004',
    name: 'Ryobi 18V Cordless Drill Driver Kit',
    description: 'Versatile cordless drill for various home repair tasks',
    category: 'tools',
    price: 149.00,
    supplier: 'Bunnings',
    location: 'Perth',
    applicableProblems: ['drilling_holes', 'screw_driving', 'general_repairs'],
    productUrl: 'https://www.bunnings.com.au/ryobi-drill-driver',
    imageUrl: 'https://bunnings.imgix.net/products/ryobi-drill-driver.jpg',
    inStock: true,
    rating: 4.6,
    reviewCount: 234
  },
  {
    id: 'bunnings_005',
    name: 'White Knight Squirts Stain Remover 500ml',
    description: 'Multi-surface stain remover for various household stains',
    category: 'cleaning',
    price: 9.80,
    supplier: 'Bunnings',
    location: 'Perth',
    applicableProblems: ['stains', 'marks', 'discoloration', 'surface_cleaning'],
    productUrl: 'https://www.bunnings.com.au/white-knight-stain-remover',
    imageUrl: 'https://bunnings.imgix.net/products/white-knight-stain-remover.jpg',
    inStock: true,
    rating: 4.1,
    reviewCount: 92
  }
];

async function seedProducts() {
  console.log('Seeding product database...');
  
  for (const product of sampleProducts) {
    try {
      await container.items.upsert(product);
      console.log(`Added product: ${product.name}`);
    } catch (error) {
      console.error(`Error adding product ${product.name}:`, error);
    }
  }
  
  console.log('Product seeding complete!');
}

seedProducts().catch(console.error);