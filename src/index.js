var express = require('express');
var cors = require('cors');
var path = require('path');
var bfhlRoute = require('./routes/bfhl');

var app = express();
var PORT = process.env.PORT || 3000;
var CLIENT_DIR = path.join(__dirname, '..', 'client');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// serve the frontend
app.use(express.static(CLIENT_DIR));

app.get('/health', function(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'bfhl-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', function(req, res) {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

// api route
app.use('/bfhl', bfhlRoute);

// anything else on /bfhl that isn't POST
app.all('/bfhl', function(req, res) {
  res.status(405).json({ error: 'Method not allowed' });
});

app.use(function(err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use(function(req, res) {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
