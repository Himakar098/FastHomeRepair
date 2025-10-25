// scripts/setup-search-index.js
//
// This script configures the Azure AI Search index used by the
// FastHomeRepair application.  The original repository defined a
// `lastUpdated` freshness profile in the scoring configuration but
// neglected to include a corresponding field in the index schema.  This
// version adds a `lastUpdated` field of type `Edm.DateTimeOffset` and
// expands the schema to capture additional product metadata such as
// `priceLow`, `priceHigh`, `link`, `imageUrl`, `state` and
// `postcode`.  These fields enable more precise filtering and sorting in
// search queries and allow the chatbot to surface richer product
// information to users.

const { SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');

// Initialise the client using environment variables.  The search
// endpoint (e.g. https://my-search.search.windows.net) and API key
// must be provided via `SEARCH_ENDPOINT` and `SEARCH_API_KEY`.
const client = new SearchIndexClient(
  process.env.SEARCH_ENDPOINT,
  new AzureKeyCredential(process.env.SEARCH_API_KEY)
);

/**
 * Definition of the `products-index`.  Azure Search requires a
 * description of all fields and their types.  Marking a field as
 * filterable or sortable allows OData filter expressions and order by
 * clauses on that property.  Setting `retrievable: true` ensures the
 * field is returned in search results.
 */
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
    // Lower end of the price range (for products that specify a range).
    {
      name: 'priceLow',
      type: 'Edm.Double',
      searchable: false,
      filterable: true,
      sortable: true,
      retrievable: true
    },
    // Higher end of the price range.
    {
      name: 'priceHigh',
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
    // Australian state/territory (e.g. QLD, NSW).  Helps refine search
    // results based on the user's location.
    {
      name: 'state',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      facetable: true,
      retrievable: true
    },
    // Postcode (integer) for more granular location filtering.
    {
      name: 'postcode',
      type: 'Edm.Int32',
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
    },
    // URL to the product page on the supplier's site.  Stored as a
    // string but not searchable.
    {
      name: 'link',
      type: 'Edm.String',
      searchable: false,
      filterable: false,
      retrievable: true
    },
    // URL to a product image if available.  Useful for the chat UI.
    {
      name: 'imageUrl',
      type: 'Edm.String',
      searchable: false,
      filterable: false,
      retrievable: true
    },
    // Timestamp when the product record was last updated.  Used by
    // freshness scoring below.
    {
      name: 'lastUpdated',
      type: 'Edm.DateTimeOffset',
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
            boostingDuration: 'P30D' // boost results updated within last 30 days
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

// Kick off the index creation when executed via node.  Use
// `node scripts/setup-search-index.js` to run this script locally.
createSearchIndex().catch(console.error);