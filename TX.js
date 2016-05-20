var	fs = require('fs'),
	https = require('https'),
	path = require('path'),
	numCPUs = require('os').cpus().length,
	options = {
		key: fs.readFileSync(path.join(__dirname, './ssl/key')),
		cert: fs.readFileSync(path.join(__dirname, './ssl/chain'))
	},
	config = require('./config'),
	bunyan = require('bunyan'),
	stream = require('gelf-stream'),
	log;

if (!!config.graylog) {
	log = bunyan.createLogger({
		name: 'TX',
		streams: [{
			type: 'raw',
			stream: stream.forBunyan(config.graylog)
		}]
	});
}else{
	log = bunyan.createLogger({
		name: 'TX'
	});
}

var app = require('./app')();
var port = process.env.PORT || 443;
https.createServer(options, app).listen(port);
log.info('Process ' + process.pid + ' is listening on port ' + port + ' to incoming TX requests.')
