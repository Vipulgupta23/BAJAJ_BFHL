var API = window.location.origin + '/bfhl';

var edgesInput = document.getElementById('edges-input');
var runBtn = document.getElementById('run-btn');
var clearBtn = document.getElementById('clear-btn');
var errMsg = document.getElementById('err-msg');
var resultsDiv = document.getElementById('results');

runBtn.onclick = function() { doSubmit(); };
clearBtn.onclick = function() {
  edgesInput.value = '';
  resultsDiv.style.display = 'none';
  errMsg.style.display = 'none';
};

// ctrl+enter shortcut
edgesInput.onkeydown = function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doSubmit();
};

function doSubmit() {
  var raw = edgesInput.value;
  var data = raw.split(/[\n,]/).map(function(s) { return s.trim(); }).filter(Boolean);

  if (data.length === 0) {
    showErr('Enter at least one edge like A->B');
    return;
  }

  errMsg.style.display = 'none';
  resultsDiv.style.display = 'none';
  runBtn.disabled = true;
  runBtn.textContent = 'Running...';

  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: data }),
  })
  .then(function(res) {
    return res.json().then(function(json) {
      if (!res.ok) {
        showErr(json.error || 'API error ' + res.status);
        return;
      }
      showResults(json);
    });
  })
  .catch(function() {
    showErr('Could not connect to API');
  })
  .finally(function() {
    runBtn.disabled = false;
    runBtn.textContent = 'Run';
  });
}

function showErr(msg) {
  errMsg.textContent = msg;
  errMsg.style.display = 'block';
}

function showResults(json) {
  // user info
  var infoEl = document.getElementById('user-info');
  infoEl.innerHTML = '';
  var fields = [
    ['User ID', json.user_id],
    ['Email', json.email_id],
    ['Roll No', json.college_roll_number]
  ];
  for (var i = 0; i < fields.length; i++) {
    var piece = document.createElement('div');
    piece.className = 'info-piece';
    piece.innerHTML = '<span class="info-label">' + fields[i][0] + '</span>' +
                      '<span class="info-val">' + esc(fields[i][1]) + '</span>';
    infoEl.appendChild(piece);
  }

  // stats
  var statsEl = document.getElementById('stats-row');
  statsEl.innerHTML = '';
  var statsData = [
    [json.summary.total_trees, 'Trees', 'green'],
    [json.summary.total_cycles, 'Cycles', 'red'],
    [json.summary.largest_tree_root || '-', 'Largest Root', 'blue']
  ];
  for (var i = 0; i < statsData.length; i++) {
    var box = document.createElement('div');
    box.className = 'stat-box';
    box.innerHTML = '<div class="stat-num ' + statsData[i][2] + '">' + esc(String(statsData[i][0])) + '</div>' +
                    '<div class="stat-txt">' + statsData[i][1] + '</div>';
    statsEl.appendChild(box);
  }

  // tree cards
  var cardsEl = document.getElementById('tree-cards');
  cardsEl.innerHTML = '';

  var h = json.hierarchies || [];
  if (h.length === 0) {
    cardsEl.innerHTML = '<p style="color:#6b7280;font-size:13px;">No hierarchies found</p>';
  }

  for (var i = 0; i < h.length; i++) {
    var card = document.createElement('div');
    card.className = 'tcard' + (h[i].has_cycle ? ' is-cycle' : '');

    var top = document.createElement('div');
    top.className = 'tcard-top';

    var rootSpan = document.createElement('span');
    rootSpan.className = 'tcard-root';
    rootSpan.textContent = h[i].root;
    top.appendChild(rootSpan);

    var badgeSpan = document.createElement('span');
    if (h[i].has_cycle) {
      badgeSpan.className = 'badge badge-cycle';
      badgeSpan.textContent = 'cycle';
    } else {
      badgeSpan.className = 'badge badge-depth';
      badgeSpan.textContent = 'depth ' + h[i].depth;
    }
    top.appendChild(badgeSpan);
    card.appendChild(top);

    if (h[i].has_cycle) {
      var msg = document.createElement('div');
      msg.className = 'cycle-msg';
      msg.textContent = 'cycle detected, no tree to show';
      card.appendChild(msg);
    } else {
      var viz = document.createElement('div');
      viz.className = 'tree-viz';
      renderTree(h[i].tree, viz, true);
      card.appendChild(viz);
    }

    cardsEl.appendChild(card);
  }

  // invalid entries
  renderTags('invalid', json.invalid_entries, 'tag-invalid');

  // duplicates
  renderTags('dup', json.duplicate_edges, 'tag-dup');

  resultsDiv.style.display = 'block';
}

function renderTree(obj, parent, isRoot) {
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (isRoot) {
      var rootDiv = document.createElement('div');
      rootDiv.className = 't-root';
      rootDiv.textContent = key;
      parent.appendChild(rootDiv);
    }

    var kids = obj[key];
    var kidKeys = Object.keys(kids);

    if (kidKeys.length === 0 && !isRoot) {
      var branch = document.createElement('div');
      branch.className = 't-branch';
      var nd = document.createElement('div');
      nd.className = 't-node t-leaf';
      nd.textContent = key;
      branch.appendChild(nd);
      parent.appendChild(branch);
    } else if (!isRoot) {
      var branch = document.createElement('div');
      branch.className = 't-branch';
      var nd = document.createElement('div');
      nd.className = 't-node';
      nd.textContent = key;
      branch.appendChild(nd);
      renderTree(kids, branch, false);
      parent.appendChild(branch);
    } else {
      renderTree(kids, parent, false);
    }
  }
}

function renderTags(prefix, items, tagClass) {
  var wrap = document.getElementById(prefix + '-wrap');
  var container = document.getElementById(prefix + '-tags');
  container.innerHTML = '';

  if (!items || items.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  for (var i = 0; i < items.length; i++) {
    var t = document.createElement('span');
    t.className = 'tag ' + tagClass;
    t.textContent = items[i] || '(empty)';
    container.appendChild(t);
  }
}

function esc(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
