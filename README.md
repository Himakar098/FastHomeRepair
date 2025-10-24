This is an app that allows users to clarify the details regarding the damages that happen in a house and decide whether to hire a specialist or do the repairs themselves. It also estimates the costs and timeline for the work that needs to be done and provides an option to order the required products or book a specialist.

## Getting started

### 1. Install dependencies

From the repository root run:

```
npm run install:all
```

This command installs packages for the root workspace along with the `backend` and `frontend` projects.

### 2. Configure environment variables

Set up the Azure service credentials expected by the backend Azure Functions (Cosmos DB, Azure AI Search, OpenAI, Computer Vision, and Blob Storage) as described in the project documentation. Expose the backend URL to the frontend via `NEXT_PUBLIC_API_BASE` (defaults to `http://localhost:7071/api`).

### 3. Run the backend

The root `package.json` defines a convenience script that changes into the backend folder and launches the Azure Functions host. Run it **from the repository root**:

```
npm run dev:backend
```

If you are already inside the `backend` directory, run the backend directly with:

```
npm start
```

Both commands start the Azure Functions Core Tools host on `http://localhost:7071/api`.

### 4. Run the frontend

In a separate terminal (also from the repository root) run:

```
npm run dev:frontend
```

This launches the Next.js development server, typically at `http://localhost:3000`.

### 5. Optional utilities

* Seed sample data:
  * `npm run seed:products`
  * `npm run seed:professionals`
* Create or update the Azure AI Search index structure with `npm run setup:search`.

### 6. Tests

Run API integration tests with:

```
npm test
```

Before running the tests, update the API base URL in `tests/api.tests.js` if you need to point to a different backend endpoint.

---
Idea: its based on house. if one want to do any repaires, or any damages in the house, users can use the chat function and or along with uploading the images, they will get the rough idea on how to fix it, what might have caused the trouble, where can they find the relavent products and how much they cost, for example -- a tenant want to clean the stains in the oven and also repair the damaged bench top, when he ask and or upload images, the app will provide the chemicals that can be used to repair and clean from bunnings and will cost 50$. Or if the problem is sever, it will provide the professionals links and how much they might charge, or they should report it to the landlord or agents for the repairs.

As of update on Oct 24, 2025 12.50pm, Current Home repair specilist services fully functional and operational and will be sent live once the Login and Authorization pages are added. Thank You for your patience.