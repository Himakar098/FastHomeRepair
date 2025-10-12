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