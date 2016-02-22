var fs = require('fs'),
	https = require('https'),
	cluster = require('cluster'),
	path = require('path'),
	numCPUs = require('os').cpus().length,
	options = {
		key: fs.readFileSync(path.join(__dirname, './ssl/key')),
		cert: fs.readFileSync(path.join(__dirname, './ssl/chain'))
	};

if (cluster.isMaster) {
	var workers = [];

	var spawn = function(i) {
    	workers[i] = cluster.fork();
	};

	for (var i = 0; i < numCPUs; i++) {
		spawn(i);
	}
	cluster.on('online', function(worker) {
		console.log('Worker ' + worker.process.pid + ' is online.');
    });
	cluster.on('exit', function(worker, code, signal) {
		console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
		console.log('Starting a new worker...');
		spawn(i);
	});
}else{
	var app = require('./app')();
	var port = process.env.PORT || 443;
	https.createServer(options, app).listen(port);
	console.log('Process ' + process.pid + ' is listening on port ' + port + ' to all incoming requests.')
}
