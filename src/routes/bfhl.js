var express = require('express');
var router = express.Router();
var identity = require('../lib/identity');
var { validateAndClassify } = require('../lib/validator');
var { buildHierarchies } = require('../lib/graph');

router.post('/', function(req, res) {
  try {
    var data = req.body.data;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'data field is required and must be an array' });
    }

    var result = validateAndClassify(data);
    var graphResult = buildHierarchies(result.valid);

    res.json({
      user_id: identity.user_id,
      email_id: identity.email_id,
      college_roll_number: identity.college_roll_number,
      hierarchies: graphResult.hierarchies,
      invalid_entries: result.invalid,
      duplicate_edges: result.duplicates,
      summary: graphResult.summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
