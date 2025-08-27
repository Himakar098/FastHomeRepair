// scripts/seed-professionals.js
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database('homerepair-db');
const container = database.container('professionals');

const sampleProfessionals = [
  {
    id: 'tradie_001',
    name: 'Perth Kitchen Repairs',
    services: ['kitchen_repairs', 'benchtop_replacement', 'cabinet_repair'],
    rating: 4.8,
    reviewCount: 127,
    priceRange: '150-300',
    contactInfo: {
      phone: '+61 8 9123 4567',
      email: 'contact@perthkitchen.com.au',
      website: 'https://perthkitchen.com.au'
    },
    serviceAreas: ['Perth Metro', 'Fremantle', 'Joondalup'],
    availability: 'weekdays',
    description: 'Specialist kitchen repair and renovation services. Over 15 years experience.',
    verified: true,
    insuranceDetails: {
      publicLiability: '5000000',
      professionalIndemnity: '2000000'
    },
    gallery: [
      'https://example.com/kitchen-repair-1.jpg',
      'https://example.com/kitchen-repair-2.jpg'
    ]
  },
  {
    id: 'tradie_002',
    name: 'Fix It Fast Plumbing',
    services: ['plumbing', 'leak_repair', 'tap_replacement', 'drain_cleaning'],
    rating: 4.6,
    reviewCount: 89,
    priceRange: '120-250',
    contactInfo: {
      phone: '+61 8 9234 5678',
      email: 'help@fixitfast.com.au',
      website: 'https://fixitfast.com.au'
    },
    serviceAreas: ['Perth Metro', 'Rockingham', 'Mandurah'],
    availability: '24/7',
    description: 'Emergency plumbing services. Licensed and insured.',
    verified: true,
    insuranceDetails: {
      publicLiability: '10000000',
      professionalIndemnity: '5000000'
    },
    gallery: [
      'https://example.com/plumbing-repair-1.jpg',
      'https://example.com/plumbing-repair-2.jpg'
    ]
  },
  {
    id: 'tradie_003',
    name: 'Perth Handyman Services',
    services: ['general_maintenance', 'wall_repair', 'painting', 'minor_electrical'],
    rating: 4.4,
    reviewCount: 156,
    priceRange: '80-180',
    contactInfo: {
      phone: '+61 8 9345 6789',
      email: 'bookings@perthhandyman.com.au',
      website: 'https://perthhandyman.com.au'
    },
    serviceAreas: ['Perth Metro', 'Swan Valley', 'Hills District'],
    availability: 'weekdays_weekends',
    description: 'Reliable handyman services for all your home maintenance needs.',
    verified: true,
    insuranceDetails: {
      publicLiability: '2000000',
      professionalIndemnity: '1000000'
    },
    gallery: [
      'https://example.com/handyman-work-1.jpg',
      'https://example.com/handyman-work-2.jpg'
    ]
  }
];

async function seedProfessionals() {
  console.log('Seeding professionals database...');
  
  for (const professional of sampleProfessionals) {
    try {
      await container.items.upsert(professional);
      console.log(`Added professional: ${professional.name}`);
    } catch (error) {
      console.error(`Error adding professional ${professional.name}:`, error);
    }
  }
  
  console.log('Professionals seeding complete!');
}

seedProfessionals().catch(console.error);