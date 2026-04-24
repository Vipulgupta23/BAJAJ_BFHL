const EDGE_RE = /^[A-Z]->[A-Z]$/;

// takes the raw data array and splits it into valid edges, invalid ones, and duplicates
function validateAndClassify(data) {
  var seen = new Set();
  var dupSet = new Set();
  var valid = [];
  var invalid = [];

  for (var i = 0; i < data.length; i++) {
    var raw = data[i];
    var entry = (typeof raw === 'string' ? raw : String(raw)).trim();

    // check format
    if (!EDGE_RE.test(entry)) {
      invalid.push(entry === '' ? raw : entry);
      continue;
    }

    // self-loop like A->A is invalid
    if (entry[0] === entry[3]) {
      invalid.push(entry);
      continue;
    }

    // track duplicates - only keep first occurrence
    if (seen.has(entry)) {
      dupSet.add(entry);
    } else {
      seen.add(entry);
      valid.push(entry);
    }
  }

  return {
    valid: valid,
    invalid: invalid,
    duplicates: Array.from(dupSet),
  };
}

module.exports = { validateAndClassify };
