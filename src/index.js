var express = require('express');
var cors = require('cors');
var path = require('path');
var bfhlRoute = require('./routes/bfhl');

var app = express();
var PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// serve the frontend
app.use(express.static(path.join(__dirname, '..', 'client')));

// api route
app.use('/bfhl', bfhlRoute);

// anything else on /bfhl that isn't POST
app.all('/bfhl', function(req, res) {
  res.status(405).json({ error: 'Method not allowed' });
});

app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
