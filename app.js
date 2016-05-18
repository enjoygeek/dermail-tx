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

	app.post('/queue', function(req, res, next) {
		
	});

	app.post('/tx-hook', function(req, res, next) {
		var compose = req.body;
		transporter.sendMail(compose, function(err, info) {
			res.setHeader('Content-Type', 'application/json');
			res.status(200).send({
				error: err,
				info: info
			});
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
