var	Queue = require('bull'),
	config = require('./config');

var messageQ = new Queue('dermail-tx', config.redisQ.port, config.redisQ.host);

var minutes = config.cleanInterval,
	the_interval = minutes * 60 * 1000;

messageQ.on('cleaned', function (job, type) {
	console.log('Cleaned %s %s jobs on', job.length, type);
});

setInterval(function() {
	messageQ.clean(5000);
}, the_interval)

console.log('Process ' + process.pid + ' is running to clean up garbage in the queue every ' + minutes + ' minutes.')
