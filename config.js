var self = module.exports = {
	apiVersion: 2,
	redisQ: require('./config.json').redisQ,
	Qconfig: {
		attempts: 50,
		backoff: {
			type: 'exponential',
			delay: 2000
		}
	},
	debug: require('./config.json').debug,
	remoteSecret: require('./config.json').remoteSecret,
	apiEndpoint: function() {
		var apiEndpoint = require('./config.json').apiEndpoint;
		return apiEndpoint + '/v' + self.apiVersion;
	},
	tx: {
		callback: function() {
			return self.apiEndpoint() + '/rx/callback';
		}
	}
}
