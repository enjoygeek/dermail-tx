var Queue = require('bull'),
	redis = require('redis'),
	config = require('./config'),
	Promise = require('bluebird'),
	request = require('superagent'),
	fs = Promise.promisifyAll(require('fs'));

Promise.promisifyAll(redis.RedisClient.prototype);

var messageQ = new Queue('dermail-tx', config.redisQ.port, config.redisQ.host);
var redisStore = redis.createClient(config.redisQ);
var debug = !!config.debug;

var start = function() {
	return new Promise(function(resolve, reject) {
		return resolve();
	});
}

var enqueue = function(type, payload) {
	return messageQ.add({
		type: type,
		payload: payload
	}, config.Qconfig);
}

start()
.then(function() {
	messageQ.process(function(job, done) {

		var data = job.data;
		var type = data.type;
		data = data.payload;

		switch (type) {
			case 'sendMail':
		}
	});
})
.catch(function(e) {
	if (debug) console.log(e);
})
