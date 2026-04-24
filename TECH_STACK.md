# Tech Stack & Implementation Guide
## BFHL Hierarchy Engine

---

## Chosen Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Specified preferred stack |
| Framework | Express 4.x | Lightweight, widely understood, zero magic |
| Frontend | Plain HTML + Vanilla JS | No build step, instant deploy, full control |
| Hosting — API | Render (free tier) | Auto-deploys from GitHub, persistent URL |
| Hosting — Frontend | Vercel or Netlify | CDN delivery, connects to GitHub repo |
| Package Manager | npm | No preference, keep it standard |

No TypeScript. No database. No auth. Every dependency must earn its place.

---

## Why Not Next.js Here

Next.js is excellent but adds friction for this challenge:
- Cold starts on serverless functions can push response time past 1s on first hit
- The evaluator hits `/bfhl` from an unknown origin — Vercel serverless handles CORS correctly, but it requires specific header configuration that is easy to get wrong
- A plain Express server on Render is predictable, always-on (after first request warms up), and trivially configured

If you are comfortable with Next.js API routes and have deployed them before: use it. If not, Express on Render is the safer path.

---

## Project Initialisation

```bash
mkdir bfhl-api && cd bfhl-api
npm init -y
npm install express cors
```

No other production dependencies needed. The entire processing logic is pure JavaScript — no graph libraries, no lodash, no utility packages. Writing it from scratch is the point.

---

## File Structure

```
bfhl-api/
├── src/
│   ├── index.js            ← Express setup, listen
│   ├── routes/
│   │   └── bfhl.js         ← Route handler, ties everything together
│   └── lib/
│       ├── identity.js     ← Your credentials, exported as a plain object
│       ├── validator.js    ← validateAndClassify(data[]) → { valid, invalid, duplicates }
│       └── graph.js        ← buildHierarchies(edges[]) → hierarchies[], summary{}
├── client/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## src/index.js

```javascript
const express = require('express');
const cors = require('cors');
const bfhlRouter = require('./routes/bfhl');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/bfhl', bfhlRouter);

// Handle wrong methods on /bfhl explicitly
app.all('/bfhl', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## src/lib/identity.js

```javascript
// Replace with your actual values before submission
module.exports = {
  user_id: 'yourname_ddmmyyyy',
  email_id: 'your.email@college.edu',
  college_roll_number: 'XXXXXXXXX',
};
```

---

## src/lib/validator.js

Responsibility: take the raw `data` array, return three buckets.

```javascript
/**
 * @param {string[]} data - raw input array
 * @returns {{ valid: string[], invalid: string[], duplicates: string[] }}
 */
function validateAndClassify(data) {
  const EDGE_REGEX = /^[A-Z]->[A-Z]$/;
  const seen = new Set();
  const duplicateSet = new Set();

  const valid = [];
  const invalid = [];

  for (const raw of data) {
    const entry = typeof raw === 'string' ? raw.trim() : String(raw).trim();

    if (!EDGE_REGEX.test(entry)) {
      invalid.push(entry === '' ? raw : entry);
      continue;
    }

    if (seen.has(entry)) {
      duplicateSet.add(entry);
    } else {
      seen.add(entry);
      valid.push(entry);
    }
  }

  return {
    valid,
    invalid,
    duplicates: Array.from(duplicateSet),
  };
}

module.exports = { validateAndClassify };
```

Key decisions:
- Self-loop (`A->A`) is caught by the regex: both sides must be a single uppercase letter, and `A->A` technically matches `/^[A-Z]->[A-Z]$/`. You need an **explicit check**: `if (parent === child) { invalid.push(entry); continue; }` — add this before the duplicate check.
- Trimming happens before everything else. An empty string after trim is still invalid.
- `duplicateSet` uses a Set so a triple-appearing edge only appears once in the output.

---

## src/lib/graph.js

This is the core. Three responsibilities: resolve multi-parent conflicts, detect cycles, compute depth.

```javascript
/**
 * @param {string[]} edges - validated, de-duplicated edges like ["A->B", "B->C"]
 * @returns {{ hierarchies: object[], summary: object }}
 */
function buildHierarchies(edges) {
  // Step 1: Parse edges into adjacency map, respecting first-parent-wins rule
  const children = {};   // parent → [child, child, ...]
  const parentOf = {};   // child → parent (first one wins)

  for (const edge of edges) {
    const [parent, child] = edge.split('->');

    if (parentOf[child] !== undefined) {
      // Multi-parent: second parent loses, silently discarded
      continue;
    }

    parentOf[child] = parent;

    if (!children[parent]) children[parent] = [];
    children[parent].push(child);
  }

  // Step 2: Collect all unique nodes
  const allNodes = new Set();
  for (const edge of edges) {
    const [p, c] = edge.split('->');
    allNodes.add(p);
    allNodes.add(c);
  }

  // Step 3: Find natural roots (nodes that are never a child)
  // But we must use the filtered parentOf (after multi-parent resolution)
  const acceptedChildren = new Set(Object.keys(parentOf));
  const naturalRoots = [...allNodes].filter(n => !acceptedChildren.has(n));

  // Step 4: Group nodes into connected components
  // Build undirected adjacency for grouping
  const adjacency = {};
  for (const node of allNodes) adjacency[node] = new Set();
  for (const edge of edges) {
    const [p, c] = edge.split('->');
    adjacency[p].add(c);
    adjacency[c].add(p);
  }

  const visited = new Set();
  const components = [];

  function dfsComponent(start) {
    const component = new Set();
    const stack = [start];
    while (stack.length) {
      const node = stack.pop();
      if (component.has(node)) continue;
      component.add(node);
      for (const neighbour of (adjacency[node] || [])) {
        if (!component.has(neighbour)) stack.push(neighbour);
      }
    }
    return component;
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      const component = dfsComponent(node);
      for (const n of component) visited.add(n);
      components.push(component);
    }
  }

  // Step 5: For each component, determine root and build hierarchy
  const hierarchies = [];

  for (const component of components) {
    const componentNodes = [...component].sort();
    const componentRoots = naturalRoots.filter(r => component.has(r));

    let root;
    if (componentRoots.length > 0) {
      root = componentRoots.sort()[0]; // lex smallest natural root
    } else {
      root = componentNodes[0]; // pure cycle: lex smallest node
    }

    // Cycle detection: directed DFS from root
    const hasCycle = detectCycle(root, children, component);

    if (hasCycle) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree = buildTree(root, children);
      const depth = computeDepth(root, children);
      hierarchies.push({ root, tree, depth });
    }
  }

  // Step 6: Summary
  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic = hierarchies.filter(h => h.has_cycle);

  let largest_tree_root = '';
  if (nonCyclic.length > 0) {
    const sorted = [...nonCyclic].sort((a, b) => {
      if (b.depth !== a.depth) return b.depth - a.depth;
      return a.root < b.root ? -1 : 1;
    });
    largest_tree_root = sorted[0].root;
  }

  const summary = {
    total_trees: nonCyclic.length,
    total_cycles: cyclic.length,
    largest_tree_root,
  };

  return { hierarchies, summary };
}

function detectCycle(root, children, componentNodes) {
  const visiting = new Set();
  const visited = new Set();

  function dfs(node) {
    visiting.add(node);
    for (const child of (children[node] || [])) {
      if (!componentNodes.has(child)) continue;
      if (visiting.has(child)) return true;
      if (!visited.has(child) && dfs(child)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  return dfs(root);
}

function buildTree(root, children) {
  const node = {};
  node[root] = {};
  for (const child of (children[root] || [])) {
    Object.assign(node[root], buildTree(child, children));
  }
  return node;
}

function computeDepth(root, children) {
  if (!children[root] || children[root].length === 0) return 1;
  return 1 + Math.max(...children[root].map(c => computeDepth(c, children)));
}

module.exports = { buildHierarchies };
```

---

## src/routes/bfhl.js

```javascript
const express = require('express');
const router = express.Router();
const identity = require('../lib/identity');
const { validateAndClassify } = require('../lib/validator');
const { buildHierarchies } = require('../lib/graph');

router.post('/', (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'data field is required and must be an array' });
  }

  const { valid, invalid, duplicates } = validateAndClassify(data);
  const { hierarchies, summary } = buildHierarchies(valid);

  return res.status(200).json({
    ...identity,
    hierarchies,
    invalid_entries: invalid,
    duplicate_edges: duplicates,
    summary,
  });
});

module.exports = router;
```

---

## Frontend: client/index.html

The frontend should be a single HTML file that:
- Imports `style.css` and `app.js`
- Has a `<textarea id="input">` pre-filled with the spec example
- Has a `<button id="submit">` 
- Has a `<div id="output">` where rendered cards go
- Has a `<div id="error">` for API error messages

No framework. No build step. The evaluator should be able to open this file in a browser pointed at the live API and have it work instantly.

---

## Frontend: client/app.js

Key implementation points:

```javascript
const API_URL = 'https://your-deployed-api.onrender.com/bfhl';

async function submit() {
  // Parse textarea: support both newline and comma-separated input
  const raw = document.getElementById('input').value;
  const data = raw
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);

  // Show loading state
  const btn = document.getElementById('submit');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });

    const json = await res.json();

    if (!res.ok) {
      showError(json.error || 'API returned an error');
      return;
    }

    renderResponse(json);
  } catch (err) {
    showError('Could not reach the API. Check your connection.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyse';
  }
}

function renderResponse(json) {
  // Clear previous output
  // Render: identity bar, hierarchy cards, invalid/duplicate lists, summary panel
  // Each hierarchy card: show root, tree visualisation, depth OR cycle badge
}
```

Tree visualisation in vanilla JS: recursive DOM building, no SVG library needed. Each level gets a `padding-left` indent and a connecting line via CSS `border-left`.

---

## Deployment

### API on Render

1. Push repository to GitHub (public).
2. Go to [render.com](https://render.com) → New Web Service → Connect repo.
3. Build command: `npm install`
4. Start command: `node src/index.js`
5. Environment: Node 20, free tier.
6. Note the deployed URL (e.g. `https://bfhl-api.onrender.com`).

### Frontend on Vercel

Option A — if frontend is in the same repo:
1. Add `vercel.json` at root pointing to the `client/` folder.
2. Connect the same GitHub repo to Vercel.
3. Override output directory to `client`.

Option B — separate repo or Netlify drag-and-drop:
1. Drop the `client/` folder onto [netlify.com/drop](https://app.netlify.com/drop).
2. Instant public URL.

Update `API_URL` in `app.js` to the Render URL before deploying frontend.

---

## .gitignore

```
node_modules/
.env
.DS_Store
```

---

## package.json scripts

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  }
}
```

`--watch` is built into Node 18+. No nodemon needed.

---

## README.md (what it must contain)

```markdown
# BFHL Hierarchy Engine

REST API + Frontend for the SRM Full Stack Engineering Challenge.

## Run Locally

git clone <your-repo-url>
cd bfhl-api
npm install
npm start

Server starts on http://localhost:3000
POST /bfhl accepts { "data": ["A->B", ...] }

## Live URLs

API: https://your-api.onrender.com
Frontend: https://your-frontend.vercel.app

## How It Works

Brief paragraph on validation → dedup → graph construction → cycle detection → depth calculation.
```

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---|---|
| `A->A` passes the regex | Add explicit `parent === child` check after parsing |
| Triple duplicate appears twice in `duplicate_edges` | Use a Set, not an array push |
| `has_cycle: false` returned for non-cyclic trees | Only set `has_cycle` when it is `true` |
| `depth` returned for cyclic trees | Skip depth entirely for cyclic groups |
| Diamond case: second parent goes into `invalid_entries` | Silently discard second parent — no output for it |
| `largest_tree_root` with wrong tiebreak | Sort by depth desc, then root lex asc |
| CORS missing on 400/500 responses | Apply `cors()` middleware before all routes, not inside the handler |
| Frontend crashes on empty `hierarchies` | Always guard `json.hierarchies?.length > 0` before rendering |

---

## What Makes This Submission Stand Out

- Code split into focused, single-responsibility modules — a reviewer can read `validator.js` in 30 seconds and understand exactly what it does
- Graph logic written from scratch with clear variable names — no opaque algorithms
- Frontend that actually looks like a tool a developer would use, not a form from 2012
- Edge cases handled correctly, especially diamond resolution and triple duplicates
- README that works on first copy-paste — no broken steps
