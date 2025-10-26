# Home Repair AI (FastHomeRepair)

An AI‑powered assistant for diagnosing home maintenance issues, recommending DIY solutions or local professionals, and suggesting products available in Australian stores. Users can chat about problems, upload photos, and receive tailored advice with cost estimates. The system combines Azure AI services, a Next.js frontend, Azure Functions for the backend, and an Azure Cognitive Search index. It also supports real‑time fallback scraping of public web pages when no matches are found in the index.

# Features

**Conversational UI** – A chat interface where users describe issues in natural language and optionally attach photos. The assistant asks follow‑up questions if key details are missing and responds with diagnosis, difficulty, materials/tools, step‑by‑step instructions, safety warnings, when to call a professional, tenant/landlord notes, and estimated cost.

**Image analysis** – Uploaded images are sent to an Azure Function that uses Azure Computer Vision to extract descriptions, tags, objects and text. The summary is passed to the assistant as context.

Product & professional matching – A search function queries an Azure Cognitive Search index and a Cosmos DB database to find relevant products (e.g. from Bunnings) and professionals near the user. The location parser extracts suburb, state and postcode from free‑form input to filter results.

Real‑time web fallback – If no products or professionals are found in the index, the backend scrapes the Bunnings website and DuckDuckGo results for the user’s query to provide up‑to‑date suggestions. These items are merged into the response.

Authentication – The app uses Azure AD B2C via MSAL. A sign‑in/out button appears in the header; authenticated users can chat, view their conversation history, and manage their account. An anonymous ID is generated for unauthenticated visitors.

Professional registration – Tradespeople can register their business, service areas and services. Their records include a servicesConcat field for searchability. Seed scripts and registration forms populate the database.

Data ingestion & search index – Utility scripts set up the Azure Cognitive Search index, seed sample data, and scrape additional products/professionals from public sources. A scoring profile boosts recent updates and highly rated items.

Quick start

Clone and install dependencies

git clone <your-fork-url>
cd homerepair-ai
npm install            # root dependencies (includes jest and cheerio)
cd backend
npm install            # backend dependencies (includes jwks-rsa, jsonwebtoken, cheerio)
cd ../frontend
npm install            # frontend dependencies


Configure environment variables

Create .env.local files in backend and frontend (or use Azure App Settings) with your secrets and endpoints:

# .env.local in backend/
COSMOS_CONNECTION_STRING=AccountEndpoint=...;AccountKey=...;
SEARCH_ENDPOINT=https://<your-search>.search.windows.net
SEARCH_API_KEY=...
SEARCH_INDEX=products-index
OPENAI_API_KEY=...
OPENAI_API_BASE=https://<your-openai-resource>.openai.azure.com
OPENAI_DEPLOYMENT_NAME=<your-gpt-deployment>
OPENAI_API_VERSION=2024-07-01-preview
PRODUCT_MATCHER_URL=http://localhost:7071/api/product-matcher
IMAGE_ANALYZER_URL=http://localhost:7071/api/image-analyzer
CORS_ALLOWED_ORIGIN=http://localhost:3000

# .env.local in frontend/
NEXT_PUBLIC_API_BASE=http://localhost:7071
NEXT_PUBLIC_B2C_TENANT=<your-b2c-tenant>
NEXT_PUBLIC_B2C_POLICY=<your-b2c-signin-policy>
NEXT_PUBLIC_B2C_CLIENT_ID=<your-b2c-client-id>
NEXT_PUBLIC_B2C_API_SCOPE=api://<your-api-client-id>/access_as_user
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000


Important: Never commit secrets (e.g. connection strings, API keys) to version control. Use .gitignore to exclude local.settings.json, .env* and other secret files.

Set up the search index and seed data

The project provides scripts to create the Azure Cognitive Search index and seed sample products/professionals. Run these from the repository root:

# Create or update the search index definition
node scripts/setup-search-index.js

# Seed sample products and professionals into Cosmos DB
node scripts/seed-products.js
node scripts/seed-professionals.js

# Optionally ingest additional data from public sites (writes JSON files)
node scripts/ingest-data.js


If you want to ingest the scraped products and professionals into the search index and database, process the JSON files (products.scraped.json, professionals.scraped.json) and upsert them via your own import script or the Azure portal.

Run the backend and frontend locally

In one terminal, start the Azure Functions backend:

cd backend
npm start      # starts Azure Functions runtime on http://localhost:7071


In another terminal, start the Next.js frontend:

cd frontend
npm run dev    # starts Next.js dev server on http://localhost:3000


Navigate to http://localhost:3000 and sign in using your Azure AD B2C tenant. Try chatting about a repair problem. If you get a 401, ensure you’ve clicked “Sign in” before interacting with the chat.

Testing

The root package.json defines a basic test script. After installing dev dependencies, run:

npm test


Load testing scripts live in tests/ and can be executed with node tests/load-test.js.

Structure
homerepair-ai/
├── backend/        # Azure Functions (chat handler, product matcher, image analyzer, register-professional)
├── frontend/       # Next.js 13 app with client components, account/history/pro pages
├── scripts/        # Search index setup, seeding, ingestion
├── package.json    # root scripts and dev dependencies (jest, cheerio)
└── README.md       # this file

Real‑time search fallback

The product-matcher function first queries your Azure Cognitive Search index and Cosmos DB. If it finds no matching products or professionals, it falls back to scraping:

Bunnings – Fetches search results from the Bunnings website for the problem query, extracting product names, prices and links.

DuckDuckGo – Searches for professionals on hipages.com.au, returning up to five service providers in the user’s location.

These fallback results are merged with the index results and returned to the chat handler. Network access is required for scraping; if outbound HTTP is blocked in your environment, the fallback will quietly return an empty list.

Professional registration

Professionals can register via the /professional page. The registration form collects:

Business name, phone, website and ABN (optional)

Service areas (comma‑separated suburbs or regions)

Services offered (comma‑separated service types)

The backend stores both the services array and a derived servicesConcat string so that the product-matcher can find matching professionals with CONTAINS queries.

Authentication and user experience

Authentication is optional but highly recommended. Without signing in, you’ll get a randomly generated session ID and your requests will be unauthenticated; the backend will reject them. Signing in with Azure AD B2C acquires a JWT and enables the chat, history and account pages. The navigation bar includes a sign‑in/out button and links to Account, Pro Signup and History.

When you chat, the assistant will display recommended products and professionals (if found) as cards. Long responses preserve line breaks for readability. If you upload an image, only common formats (JPEG/PNG/WebP) under ~10 MB are accepted.

Future improvements

Better result presentation – Render structured JSON responses as expandable cards or tables rather than plain text.

Robust ingestion – Use official APIs for retailers and business directories instead of HTML scraping.

Notifications – Alert professionals when new repair jobs in their area are created.

Internationalisation – Support currencies, products and regulations outside Australia.

Contributions are welcome! Please open issues or pull requests to suggest improvements.

---
Idea: its based on house. if one want to do any repaires, or any damages in the house, users can use the chat function and or along with uploading the images, they will get the rough idea on how to fix it, what might have caused the trouble, where can they find the relavent products and how much they cost, for example -- a tenant want to clean the stains in the oven and also repair the damaged bench top, when he ask and or upload images, the app will provide the chemicals that can be used to repair and clean from bunnings and will cost 50$. Or if the problem is sever, it will provide the professionals links and how much they might charge, or they should report it to the landlord or agents for the repairs.

As of update on Oct 24, 2025 12.50pm, Current Home repair specilist services fully functional and operational and will be sent live once the Login and Authorization pages are added. Thank You for your patience.