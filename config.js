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
	cleanInterval: require('./config.json').cleanInterval || 10,
	graylog: require('./config.json').graylog || null,
	remoteSecret: require('./config.json').remoteSecret,
	apiEndpoint: function() {
		var apiEndpoint = require('./config.json').apiEndpoint;
		return apiEndpoint + '/v' + self.apiVersion;
	},
	tx: {
		hook: function() {
			return self.apiEndpoint() + '/rx/store-tx';
		},
		notify: function() {
			return self.apiEndpoint() + '/rx/notify';
		}
	}
}
