module.exports = function() {
	var Queue = require('bull'),
		express = require('express'),
		bodyParser = require('body-parser'),
		Queue = require('bull'),
		config = require('./config'),
		Promise = require('bluebird'),
		app = express();

	app.use(bodyParser.json({limit: '55mb'}));
	app.use(bodyParser.urlencoded({ extended: true, limit: '55mb' }));

	var messageQ = new Queue('dermail-tx', config.redisQ.port, config.redisQ.host);

	app.post('/tx-hook', function(req, res, next) {

		var remoteSecret = req.body.remoteSecret || null;

		if (remoteSecret !== config.remoteSecret) {
			return res.status(200).send({ok: false, error: 'Invalid remoteSecret.'});
		}

		var compose = req.body;

		return messageQ.add({
			type: 'sendMail',
			payload: compose
		}, config.Qconfig)
		.then(function() {
			return res.status(200).send({ok: true});
		})

	});

	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
	  var err = new Error('Not Found');
	  err.status = 404;
	  next(err);
	});

	// error handlers

	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
	  res.status(err.status || 500);
	  res.send({
		  message: err.message,
		  error: {}
	  });
	});

	return app;

}
