// scripts/setup-search-index.js
const { SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');

const client = new SearchIndexClient(
  process.env.SEARCH_ENDPOINT,
  new AzureKeyCredential(process.env.SEARCH_API_KEY)
);

const indexDefinition = {
  name: 'products-index',
  fields: [
    {
      name: 'id',
      type: 'Edm.String',
      key: true,
      searchable: false,
      filterable: true,
      retrievable: true
    },
    {
      name: 'name',
      type: 'Edm.String',
      searchable: true,
      filterable: false,
      retrievable: true,
      analyzer: 'en.microsoft'
    },
    {
      name: 'description',
      type: 'Edm.String',
      searchable: true,
      filterable: false,
      retrievable: true,
      analyzer: 'en.microsoft'
    },
    {
      name: 'category',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      facetable: true,
      retrievable: true
    },
    {
      name: 'price',
      type: 'Edm.Double',
      searchable: false,
      filterable: true,
      sortable: true,
      retrievable: true
    },
    {
      name: 'supplier',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      facetable: true,
      retrievable: true
    },
    {
      name: 'location',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      retrievable: true
    },
    {
      name: 'problems',
      type: 'Collection(Edm.String)',
      searchable: true,
      filterable: true,
      retrievable: true
    },
    {
      name: 'inStock',
      type: 'Edm.Boolean',
      searchable: false,
      filterable: true,
      retrievable: true
    },
    {
      name: 'rating',
      type: 'Edm.Double',
      searchable: false,
      filterable: true,
      sortable: true,
      retrievable: true
    }
  ],
  scoringProfiles: [
    {
      name: 'relevanceProfile',
      textWeights: {
        name: 3,
        description: 2,
        problems: 5
      },
      functions: [
        {
          type: 'freshness',
          fieldName: 'lastUpdated',
          boost: 1.5,
          interpolation: 'linear',
          freshness: {
            boostingDuration: 'P30D'
          }
        }
      ]
    }
  ],
  suggesters: [
    {
      name: 'product-suggester',
      searchMode: 'analyzingInfixMatching',
      sourceFields: ['name', 'problems']
    }
  ]
};

async function createSearchIndex() {
  try {
    console.log('Creating search index...');
    await client.createIndex(indexDefinition);
    console.log('Search index created successfully!');
  } catch (error) {
    console.error('Error creating search index:', error);
  }
}

createSearchIndex().catch(console.error);