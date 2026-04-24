# Product Requirements Document
## SRM Full Stack Engineering Challenge — BFHL Hierarchy Engine

---

## 1. What We're Building

A production-grade REST API backed by a polished single-page frontend. The system accepts raw edge-notation strings (like `"A->B"`), parses them into trees, detects cycles, and returns a rich JSON response. The frontend gives evaluators a clean, interactive way to test the API and visualise results.

This is not a toy project. The goal is to ship something that reads like it was written by a mid-level engineer who cares deeply about correctness, observability, and user experience — not something assembled the night before a deadline.

---

## 2. Scope

### In Scope
- `POST /bfhl` REST endpoint with full processing logic
- Frontend SPA that calls the hosted API and renders the response visually
- CORS handling, input validation, error responses
- Deployment to a public URL (Vercel / Render / Railway)
- Public GitHub repository

### Out of Scope
- Authentication / API keys
- Persistent storage / databases
- Rate limiting (beyond what the host provides)
- WebSocket or streaming responses

---

## 3. API Specification

### Endpoint

```
POST /bfhl
Content-Type: application/json
```

### Request Body

```json
{
  "data": ["A->B", "A->C", "B->D"]
}
```

`data` must be a non-empty array. Each element is a string. Malformed elements are not rejected at the request level — they are classified and returned in `invalid_entries`.

---

### Response Schema

```json
{
  "user_id": "string",
  "email_id": "string",
  "college_roll_number": "string",
  "hierarchies": [ HierarchyObject ],
  "invalid_entries": ["string"],
  "duplicate_edges": ["string"],
  "summary": SummaryObject
}
```

**HierarchyObject**

```json
{
  "root": "A",
  "tree": { "A": { "B": { "D": {} }, "C": {} } },
  "depth": 3
}
```

For cyclic groups:

```json
{
  "root": "X",
  "tree": {},
  "has_cycle": true
}
```

Rules:
- `depth` is only present on non-cyclic hierarchies.
- `has_cycle` is only present and `true` when a cycle exists — never returned as `false`.

**SummaryObject**

```json
{
  "total_trees": 3,
  "total_cycles": 1,
  "largest_tree_root": "A"
}
```

---

## 4. Processing Rules (Strict)

### 4.1 Identity Fields

Hardcode once, at the top of the server file. Values must match your actual credentials:

```
user_id          → fullname_ddmmyyyy   (e.g. "johndoe_17091999")
email_id         → your college email
college_roll_number → your roll number
```

---

### 4.2 Input Validation

Before any graph logic runs, every string in `data` must be:

1. Trimmed of leading and trailing whitespace.
2. Tested against the regex: `/^[A-Z]->[A-Z]$/`

Anything that fails goes into `invalid_entries`. Valid strings proceed.

| Input | Verdict | Reason |
|---|---|---|
| `"A->B"` | Valid | — |
| `" A->B "` | Valid after trim | Whitespace stripped first |
| `"hello"` | Invalid | Not edge format |
| `"1->2"` | Invalid | Not uppercase letters |
| `"AB->C"` | Invalid | Multi-char parent |
| `"A-B"` | Invalid | Wrong separator |
| `"A->"` | Invalid | Missing child |
| `"A->A"` | Invalid | Self-loop |
| `""` | Invalid | Empty string |

---

### 4.3 Duplicate Detection

After validation, scan the valid edges list. The **first occurrence** of each `Parent->Child` pair is kept. Every subsequent identical pair is appended to `duplicate_edges` exactly once — even if the same edge appears three or four times, it appears in `duplicate_edges` only once.

```
Input:  ["A->B", "A->B", "A->B"]
Result: duplicate_edges: ["A->B"]   // NOT ["A->B", "A->B"]
```

---

### 4.4 Multi-Parent (Diamond) Resolution

If two valid edges share the same child (e.g. `A->D` and `B->D`), the **first-encountered** parent edge wins. The second edge for that child is silently discarded — it does not go into `duplicate_edges` and is not used in tree construction.

---

### 4.5 Tree Construction

Using the de-duplicated, validated edge set:

1. Identify **root nodes**: nodes that appear as a parent but never as a child in any valid, accepted edge.
2. For pure-cycle groups where every node is also a child: pick the **lexicographically smallest node** as the artificial root.
3. Build each tree recursively from its root, following parent→child edges.
4. Multiple independent trees are returned as separate objects in the `hierarchies` array.

---

### 4.6 Cycle Detection

Run DFS from each root. If a back-edge is found (revisiting a node already on the current recursion stack), the entire group is flagged:

```json
{
  "root": "X",
  "tree": {},
  "has_cycle": true
}
```

No `depth` field. No nested tree.

---

### 4.7 Depth Calculation

Depth = the number of **nodes** (not edges) on the longest root-to-leaf path.

```
A -> B -> C   →   depth: 3
A -> B        →   depth: 2
A             →   depth: 1
```

---

### 4.8 Summary Calculation

- `total_trees` → count of hierarchy objects that do **not** have `has_cycle`.
- `total_cycles` → count of hierarchy objects that **have** `has_cycle: true`.
- `largest_tree_root` → root of the non-cyclic tree with the greatest depth. Tiebreak: lexicographically smaller root wins.

---

## 5. Edge Cases to Handle Explicitly

These will be tested by the evaluator:

| Scenario | Expected Behaviour |
|---|---|
| Empty `data` array | Return empty `hierarchies`, `invalid_entries`, `duplicate_edges`; `summary` with zeroes |
| All entries invalid | Same as above with all strings in `invalid_entries` |
| All entries duplicates | One tree from first occurrences, duplicates in `duplicate_edges` |
| Single node with no edges | Not possible via edge format — every valid entry has both parent and child |
| Two trees with same depth | `largest_tree_root` = lexicographically smaller root |
| Long chain A->B->C->...->Z | Depth = 26, no cycle |
| Pure cycle with no natural root | Lex-smallest node as root, `has_cycle: true`, `tree: {}` |
| Mixed: valid + invalid + duplicate + cycle | All four fields populated correctly, independently |

---

## 6. HTTP Behaviour

| Scenario | Status Code | Response |
|---|---|---|
| Valid request, processed | `200 OK` | Full response schema |
| Missing `data` field | `400 Bad Request` | `{ "error": "data field is required and must be an array" }` |
| `data` is not an array | `400 Bad Request` | Same |
| Wrong HTTP method (GET, etc.) | `405 Method Not Allowed` | `{ "error": "Method not allowed" }` |
| Server error | `500 Internal Server Error` | `{ "error": "Internal server error" }` |

---

## 7. CORS

Allow all origins for the evaluator:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Handle `OPTIONS` preflight requests with `200 OK`.

---

## 8. Performance

- The API must respond in **under 3 seconds** for inputs with up to 50 node strings.
- All processing is in-memory — no I/O bottlenecks.
- No external API calls in the critical path.

---

## 9. Frontend Requirements

### 9.1 Core Functionality

- A textarea where users type or paste node strings (one per line, or comma-separated — handle both).
- A **Submit** button that POSTs to `/bfhl`.
- Structured visual display of the response.
- Clear error state if the API call fails.

### 9.2 Display Components

| Section | What to Show |
|---|---|
| Identity bar | `user_id`, `email_id`, `college_roll_number` |
| Hierarchies | One card per tree — root label, visual nested tree, depth badge OR cycle badge |
| Invalid Entries | Highlighted list with the reason (derived from format) |
| Duplicate Edges | Highlighted list |
| Summary | Three stats: total trees, total cycles, largest tree root |

### 9.3 UX Details

- Loading state on the Submit button while the request is in-flight.
- The textarea should support both newline-separated and comma-separated input.
- Errors from the API (4xx / 5xx) displayed in a non-modal, inline error banner.
- Pre-filled example input so the evaluator can hit Submit immediately.

### 9.4 Design Direction

The UI should feel like a **developer tool** — think dark-themed graph explorer, monospace accents, clean hierarchy visualisation. Not a generic form. Reference aesthetic: VS Code meets a data pipeline dashboard.

Specific expectations:
- Dark background (`#0d1117` or similar)
- Monospace font for node labels and edge strings
- Animated tree expansion on render
- Depth displayed as a subtle badge on each tree card
- Cycle trees visually distinguished (red tint, different icon)
- Responsive down to 768px

---

## 10. Project Structure

```
/
├── api/
│   ├── index.js          ← Express app entrypoint, route registration
│   ├── routes/
│   │   └── bfhl.js       ← POST /bfhl handler
│   └── lib/
│       ├── validator.js   ← Input validation logic
│       ├── graph.js       ← Tree building, cycle detection, depth calc
│       └── identity.js    ← Hardcoded user identity fields
├── client/
│   ├── index.html
│   ├── style.css
│   └── app.js            ← API call, response rendering
├── package.json
├── .env.example
└── README.md
```

If using Next.js, adjust accordingly:

```
/
├── pages/
│   ├── api/
│   │   └── bfhl.js
│   └── index.js
├── components/
│   ├── TreeCard.jsx
│   ├── SummaryPanel.jsx
│   └── InputPanel.jsx
├── lib/
│   ├── validator.js
│   └── graph.js
└── styles/
    └── globals.css
```

---

## 11. Testing Checklist

Before submission, manually test these inputs:

**Test 1 — Example from spec**
```json
["A->B","A->C","B->D","C->E","E->F","X->Y","Y->Z","Z->X","P->Q","Q->R","G->H","G->H","G->I","hello","1->2","A->"]
```
Expected: 3 trees, 1 cycle, `largest_tree_root: "A"`, 3 invalid entries, 1 duplicate.

**Test 2 — All invalid**
```json
["hello","world","123","AB->C"]
```
Expected: empty hierarchies, all four in `invalid_entries`.

**Test 3 — Pure cycle no natural root**
```json
["B->C","C->A","A->B"]
```
Expected: root = `"A"` (lex smallest), `has_cycle: true`, `tree: {}`.

**Test 4 — Diamond / multi-parent**
```json
["A->D","B->D","A->E","B->F"]
```
Expected: `B->D` silently discarded, two separate trees for `A` and `B`.

**Test 5 — Duplicate appears 3 times**
```json
["A->B","A->B","A->B"]
```
Expected: `duplicate_edges: ["A->B"]` (only once).

**Test 6 — Tie in depth**
```json
["A->B","B->C","D->E","E->F"]
```
Expected: both depth 3, `largest_tree_root: "A"` (lex smaller than `"D"`).

---

## 12. Submission Checklist

- [ ] `POST /bfhl` returns correct response for all test cases above
- [ ] CORS headers present on all responses
- [ ] Frontend pre-filled with example, Submit works end-to-end
- [ ] Error state shows correctly when API is unreachable
- [ ] GitHub repository is public
- [ ] `README.md` explains how to run locally (`npm install` + `npm start`)
- [ ] No hardcoded mock responses — every input produces real output
- [ ] API responds in < 3 seconds for 50-node inputs

---

## 13. What Separates a Good Submission from a Great One

- **Clean code structure** — reviewers skim repos. Logical file organisation, no 500-line god files.
- **Readable logic** — the graph processing code should be the most readable part of the repo. Comments where the algorithm is non-obvious.
- **A UI worth screenshotting** — the evaluator note literally says "good looking UI often attracts evaluator." Treat this seriously.
- **Edge case correctness** — most submissions will fail on the diamond case or the triple-duplicate case. Nail those.
- **Honest README** — one command to install, one command to run. No broken setup instructions.
