// builds the hierarchy objects and summary from a list of valid unique edges

function buildHierarchies(edges) {
  if (!edges || edges.length === 0) {
    return {
      hierarchies: [],
      summary: { total_trees: 0, total_cycles: 0, largest_tree_root: '' },
    };
  }

  // parse edges into parent->children map
  // if a child already has a parent, we skip that edge (diamond case)
  var children = {};
  var parentOf = {};
  var usedEdges = [];

  for (var i = 0; i < edges.length; i++) {
    var p = edges[i][0];
    var c = edges[i][3];

    if (parentOf[c] !== undefined) continue; // already has parent, skip

    parentOf[c] = p;
    if (!children[p]) children[p] = [];
    children[p].push(c);
    usedEdges.push(edges[i]);
  }

  // get all nodes that actually made it into the graph
  var allNodes = new Set();
  for (var i = 0; i < usedEdges.length; i++) {
    allNodes.add(usedEdges[i][0]);
    allNodes.add(usedEdges[i][3]);
  }

  // roots = nodes that never show up as a child
  var childSet = new Set(Object.keys(parentOf));
  var roots = [];
  allNodes.forEach(function(n) {
    if (!childSet.has(n)) roots.push(n);
  });

  // group into connected components using undirected adjacency
  var adj = {};
  allNodes.forEach(function(n) { adj[n] = new Set(); });
  for (var i = 0; i < usedEdges.length; i++) {
    adj[usedEdges[i][0]].add(usedEdges[i][3]);
    adj[usedEdges[i][3]].add(usedEdges[i][0]);
  }

  var visited = new Set();
  var components = [];
  allNodes.forEach(function(startNode) {
    if (visited.has(startNode)) return;
    var comp = new Set();
    var stack = [startNode];
    while (stack.length > 0) {
      var curr = stack.pop();
      if (comp.has(curr)) continue;
      comp.add(curr);
      adj[curr].forEach(function(nb) {
        if (!comp.has(nb)) stack.push(nb);
      });
    }
    comp.forEach(function(n) { visited.add(n); });
    components.push(comp);
  });

  // process each component
  var hierarchies = [];

  for (var ci = 0; ci < components.length; ci++) {
    var comp = components[ci];
    var compNodes = Array.from(comp).sort();
    var compRoots = roots.filter(function(r) { return comp.has(r); }).sort();

    // pick root: first natural root, or lex smallest node for pure cycles
    var root = compRoots.length > 0 ? compRoots[0] : compNodes[0];

    if (hasCycleInComponent(comp, children)) {
      hierarchies.push({ root: root, tree: {}, has_cycle: true });
    } else {
      var tree = makeTree(root, children);
      var d = calcDepth(root, children);
      hierarchies.push({ root: root, tree: tree, depth: d });
    }
  }

  // summary
  var treesOnly = hierarchies.filter(function(h) { return !h.has_cycle; });
  var cyclesOnly = hierarchies.filter(function(h) { return h.has_cycle; });

  var biggestRoot = '';
  if (treesOnly.length > 0) {
    treesOnly.sort(function(a, b) {
      if (b.depth !== a.depth) return b.depth - a.depth;
      return a.root < b.root ? -1 : 1;
    });
    biggestRoot = treesOnly[0].root;
  }

  return {
    hierarchies: hierarchies,
    summary: {
      total_trees: treesOnly.length,
      total_cycles: cyclesOnly.length,
      largest_tree_root: biggestRoot,
    },
  };
}

// check if any cycle exists in this component using DFS
function hasCycleInComponent(compNodes, children) {
  var visiting = new Set();
  var done = new Set();

  function dfs(node) {
    visiting.add(node);
    var kids = children[node] || [];
    for (var i = 0; i < kids.length; i++) {
      if (!compNodes.has(kids[i])) continue;
      if (visiting.has(kids[i])) return true;
      if (!done.has(kids[i]) && dfs(kids[i])) return true;
    }
    visiting.delete(node);
    done.add(node);
    return false;
  }

  var nodes = Array.from(compNodes);
  for (var i = 0; i < nodes.length; i++) {
    if (!done.has(nodes[i])) {
      if (dfs(nodes[i])) return true;
    }
  }
  return false;
}

// recursively build the nested tree object
function makeTree(node, children) {
  var obj = {};
  obj[node] = {};
  var kids = children[node] || [];
  for (var i = 0; i < kids.length; i++) {
    Object.assign(obj[node], makeTree(kids[i], children));
  }
  return obj;
}

// depth = number of nodes on longest root-to-leaf path
function calcDepth(node, children) {
  var kids = children[node] || [];
  if (kids.length === 0) return 1;
  var maxChildDepth = 0;
  for (var i = 0; i < kids.length; i++) {
    var d = calcDepth(kids[i], children);
    if (d > maxChildDepth) maxChildDepth = d;
  }
  return 1 + maxChildDepth;
}

module.exports = { buildHierarchies };
