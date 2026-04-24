# bfhl-api

My submission for the SRM Full Stack Engineering Challenge (Round 1).

## Setup

```
npm install
npm start
```

Opens on http://localhost:3000. The frontend is served from the same server.

API endpoint: `POST /bfhl` with body `{ "data": ["A->B", "A->C", ...] }`

## What it does

Takes a list of edge strings like `A->B`, validates them, builds tree hierarchies, finds cycles, and returns everything in a structured JSON response.

The processing handles:
- input validation (format check, self-loops)
- duplicate edge detection
- diamond/multi-parent resolution (first parent wins)
- cycle detection using DFS
- depth calculation (node count on longest path)

Frontend lets you paste edges and see the parsed result visually.

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
```
