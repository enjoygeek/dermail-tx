var	fs = require('fs'),
	https = require('https'),
	path = require('path'),
	numCPUs = require('os').cpus().length,
	options = {
		key: fs.readFileSync(path.join(__dirname, './ssl/key')),
		cert: fs.readFileSync(path.join(__dirname, './ssl/chain'))
	};

var app = require('./app')();
var port = process.env.PORT || 443;
https.createServer(options, app).listen(port);
console.log('Process ' + process.pid + ' is listening on port ' + port + ' to incoming TX requests.')
