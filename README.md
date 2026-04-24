# bfhl-api

My submission for the SRM Full Stack Engineering Challenge (Round 1).

## Local setup

```bash
npm install
npm start
```

App runs on `http://localhost:3000`. The frontend is served from the same Express server.

Useful routes:
- `GET /` - frontend UI
- `GET /health` - deployment health check
- `POST /bfhl` - API endpoint with body `{ "data": ["A->B", "A->C"] }`

## Environment variables

Copy `.env.example` to `.env` if you want to override the port locally.

```bash
cp .env.example .env
```

Supported variables:
- `PORT` - server port, defaults to `3000`

## What it does

Takes a list of edge strings like `A->B`, validates them, builds tree hierarchies, finds cycles, and returns everything in a structured JSON response.

The processing handles:
- input validation (format check, self-loops)
- duplicate edge detection
- diamond/multi-parent resolution (first parent wins)
- cycle detection using DFS
- depth calculation (node count on longest path)

Frontend lets you paste edges and see the parsed result visually.

## Deployment readiness

This repo is ready to deploy as a standard Node.js web service:
- `npm install` installs all dependencies
- `npm start` starts the production server
- the app binds to `process.env.PORT`
- `GET /health` is available for health checks
- `render.yaml` is included for one-click Render deployment

## Deploy on Render

### Option 1: Using `render.yaml`

1. Push this project to GitHub.
2. Open [Render](https://render.com/).
3. Click `New +` and choose `Blueprint`.
4. Connect your GitHub repository.
5. Render will detect `render.yaml`.
6. Review the service settings and click `Apply`.
7. Wait for the first deployment to finish.
8. Open the generated URL and test:
   - `/health`
   - `/`
   - `POST /bfhl`

### Option 2: Manual web service setup

1. Push this project to GitHub.
2. In Render, click `New +` and choose `Web Service`.
3. Select your GitHub repository.
4. Use these settings:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add no environment variables unless you want a custom `PORT`.
6. Deploy the service.

## Deploy on Railway

1. Push this project to GitHub.
2. Open [Railway](https://railway.app/).
3. Create a new project from your GitHub repository.
4. Railway should detect Node automatically.
5. Keep the start command as `npm start` if prompted.
6. Deploy and test `/health`.

## API example

```bash
curl -X POST http://localhost:3000/bfhl \
  -H "Content-Type: application/json" \
  -d '{"data":["A->B","A->C","B->D","X->Y","Y->X"]}'
```

## Project structure

```
src/
  index.js         - express server
  routes/bfhl.js   - POST /bfhl handler
  lib/
    identity.js    - my credentials
    validator.js   - input validation + dedup
    graph.js       - tree building, cycles, depth
client/
  index.html       - frontend page
  style.css        - styling
  app.js           - frontend logic
render.yaml        - Render deployment config
```
