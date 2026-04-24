# SRM Full Stack Engineering Challenge — Complete Specification Reference
## Round 1 — BFHL Endpoint

> This document is a faithful, structured transcription of the official challenge PDF.
> Every rule, example, field, edge case, and submission requirement from the original spec is captured here.
> Attach this alongside PRD.md and TECH_STACK.md so the implementation agent has the original source of truth.

---

## Objective

Build and host a REST API (`POST /bfhl`) that:
- Accepts an array of node strings
- Processes hierarchical relationships between nodes
- Returns structured insights about those hierarchies

Also build a frontend that lets users interact with the API.

**Preferred Stack:** Node.js / JavaScript

---

## API Specification

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

---

### Response Schema

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Format: `"fullname_ddmmyyyy"` e.g. `"johndoe_17091999"` |
| `email_id` | string | Your college email address |
| `college_roll_number` | string | Your college roll number |
| `hierarchies` | array | Array of hierarchy objects (see Processing Rules) |
| `invalid_entries` | string[] | Entries that did not match the valid node format |
| `duplicate_edges` | string[] | Repeated edges after the first occurrence |
| `summary` | object | `total_trees`, `total_cycles`, `largest_tree_root` |

---

### Hierarchy Object Structure

```json
{
  "root": "string",
  "tree": {},
  "depth": 0,
  "has_cycle": true
}
```

| Field | Notes |
|---|---|
| `root` | Root node label |
| `tree` | Nested tree object. Empty `{}` if cycle exists |
| `depth` | Node count on longest root-to-leaf path. **Only present for non-cyclic trees** |
| `has_cycle` | **Only present (and `true`) when a cycle is detected. Never return as `false`** |

---

### Summary Object Structure

```json
{
  "total_trees": 0,
  "total_cycles": 0,
  "largest_tree_root": "string"
}
```

| Field | Notes |
|---|---|
| `total_trees` | Count of valid non-cyclic trees |
| `total_cycles` | Count of cyclic groups |
| `largest_tree_root` | Root of the tree with the greatest depth |

---

## Processing Rules

### Rule 1 — Identity Fields

- `user_id` format: `fullname_ddmmyyyy` (e.g. `johndoe_17091999`)
- `email_id` and `college_roll_number` must be your **actual credentials**

---

### Rule 2 — Valid Node Format

Each valid entry must follow the pattern `X->Y` where:
- `X` is a **single uppercase letter** (A–Z)
- `Y` is a **single uppercase letter** (A–Z)

The following inputs are **invalid** and must be pushed to `invalid_entries`:

| Input | Reason |
|---|---|
| `"hello"` | Not a node format |
| `"1->2"` | Not uppercase letters |
| `"AB->C"` | Multi-character parent |
| `"A-B"` | Wrong separator |
| `"A->"` | Missing child node |
| `"A->A"` | Self-loop — treated as invalid |
| `""` | Empty string |
| `" A->B "` | Trim whitespace first, then validate |

> **Note on trimming:** Trim whitespace first. If `" A->B "` trims to `"A->B"` and passes validation, it is valid. The trimmed value is what gets used everywhere.

---

### Rule 3 — Duplicate Edges

- If the same `Parent->Child` pair appears more than once, use the **first occurrence** for tree construction.
- Push **all subsequent occurrences** to `duplicate_edges` **once each**, regardless of how many times they repeat.

```
Example: ["A->B", "A->B", "A->B"] → duplicate_edges: ["A->B"]
```

The same duplicate edge appears in `duplicate_edges` only **once**, no matter how many times it is repeated in the input.

---

### Rule 4 — Tree Construction

- Build trees from valid, non-duplicate edges.
- There can be **multiple independent trees** — return each separately in the `hierarchies` array.
- A **root** is a node that **never appears as a child** in any valid edge.
- If a group has **no valid root** (pure cycle — all nodes appear as children), use the **lexicographically smallest node** as the root.
- **Diamond / multi-parent case:** if a node has more than one parent (e.g. `A->D` and `B->D`), the **first-encountered parent edge wins**; subsequent parent edges for that child are **silently discarded**.

---

### Rule 5 — Cycle Detection

- If a cycle exists within a group:
  - Return `has_cycle: true`
  - Return `tree: {}`
  - **Do not include a `depth` field** for cyclic groups
- For non-cyclic trees:
  - **Omit `has_cycle` entirely** (do not return it as `false`)

---

### Rule 6 — Depth Calculation

Depth = number of **nodes** on the longest root-to-leaf path.

```
A->B->C   →   depth: 3   (nodes A, B, C)
A->B      →   depth: 2   (nodes A, B)
A         →   depth: 1   (node A alone)
```

---

### Rule 7 — Summary Rules

- `largest_tree_root` **tiebreaker:** if two trees have equal depth, return the **lexicographically smaller** root.
- `total_trees` counts only **valid, non-cyclic** trees.

---

## Full Example

### Request

```json
{
  "data": [
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->Z", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->"
  ]
}
```

### Expected Response

```json
{
  "user_id": "johndoe_17091999",
  "email_id": "john.doe@college.edu",
  "college_roll_number": "21CS1001",
  "hierarchies": [
    {
      "root": "A",
      "tree": { "A": { "B": { "D": {} }, "C": { "E": { "F": {} } } } },
      "depth": 4
    },
    {
      "root": "X",
      "tree": {},
      "has_cycle": true
    },
    {
      "root": "P",
      "tree": { "P": { "Q": { "R": {} } } },
      "depth": 3
    },
    {
      "root": "G",
      "tree": { "G": { "H": {}, "I": {} } },
      "depth": 2
    }
  ],
  "invalid_entries": ["hello", "1->2", "A->"],
  "duplicate_edges": ["G->H"],
  "summary": {
    "total_trees": 3,
    "total_cycles": 1,
    "largest_tree_root": "A"
  }
}
```

### Walkthrough of the Example

- **Tree A:** `A->B`, `A->C`, `B->D`, `C->E`, `E->F` form one connected tree. Root = A (never a child). Depth = 4 (A→C→E→F).
- **Cycle X:** `X->Y`, `Y->Z`, `Z->X` form a cycle. All nodes appear as children. Root = X (lex smallest of X, Y, Z). `tree: {}`, `has_cycle: true`.
- **Tree P:** `P->Q`, `Q->R`. Root = P. Depth = 3.
- **Tree G:** `G->H` appears twice — first kept, second → `duplicate_edges`. `G->I` is valid. Root = G. Depth = 2.
- **Invalid:** `"hello"` (not edge format), `"1->2"` (not uppercase), `"A->"` (missing child).
- **Summary:** 3 non-cyclic trees, 1 cycle, largest tree root = A (depth 4).

---

## Frontend Requirements

Build a **single-page frontend** that:

1. Has an **input field or text area** where users can enter the node list
2. Has a **Submit button** that calls your hosted API at `/bfhl`
3. Displays the API response in a **readable, structured format** — tree view, cards, or table (your choice)
4. Shows a **clear error message** if the API call fails

> Note from spec: *"good looking UI often attracts evaluator ☺"*

No specific framework is required. Plain HTML/CSS/JS, React, Vue, Next.js — anything works.

---

## Tech Stack & Hosting

| Item | Requirement |
|---|---|
| Preferred stack | Node.js / JavaScript (including Next.js, NestJS, Express) |
| Hosting | Vercel, Render, Netlify, Railway, or any provider |
| Repository | Push to a **public GitHub repository** — submission requires the repo URL |

---

## Evaluation Notes

- Your API must respond in **under 3 seconds** for inputs of up to 50 nodes
- **Enable CORS** on your API — the evaluator calls it from a different origin
- The `/bfhl` route must accept **POST requests** with `Content-Type: application/json`
- **Do not hardcode responses** — your API will be tested against multiple hidden inputs
- **Plagiarism check will be run** on all GitHub repos. Identical or near-identical code across submissions = **disqualification**

---

## Submission Requirements

Fill in the submission form at the link provided. You will need to share:

1. Your **hosted API base URL** (evaluator will call `<your-url>/bfhl`)
2. Your **hosted frontend URL**
3. Your **public GitHub repository URL**

> **Note:** Fastest valid submissions are given priority in the event of tied scores.

---

## Quick Rule Summary (Agent Reference)

| Rule | Key Point |
|---|---|
| Validation | Regex `^[A-Z]->[A-Z]$` after trim. Self-loops (`A->A`) also invalid. |
| Duplicates | First occurrence kept. All subsequent → `duplicate_edges` once, regardless of repeat count. |
| Multi-parent | First parent edge wins. Second parent edge silently discarded (not to invalid, not to duplicates). |
| Root detection | Node that never appears as a child in any accepted edge. |
| Pure cycle root | Lexicographically smallest node in the cycle group. |
| Cycle output | `tree: {}`, `has_cycle: true`, no `depth` field. |
| Non-cycle output | Nested tree object, `depth` field, no `has_cycle` field at all. |
| Depth | Count of nodes on longest path from root to leaf (inclusive). |
| Largest tree tiebreak | Equal depth → lexicographically smaller root wins. |
| CORS | Must be enabled — evaluator calls from a different origin. |
| Response time | Under 3 seconds for up to 50 node strings. |
| No hardcoding | API tested against hidden inputs. |
