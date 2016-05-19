var os = require('os'),
	Queue = require('bull'),
	redis = require('redis'),
	config = require('./config'),
	Promise = require('bluebird'),
	request = require('superagent'),
	mailcomposer = require("mailcomposer"),
	MailParser = require("mailparser").MailParser,
	htmlToText = require('html-to-text'),
	nodemailer = require('nodemailer'),
	hostname = os.hostname(),
	transporter,
	fs = Promise.promisifyAll(require('fs'));

Promise.promisifyAll(redis.RedisClient.prototype);

var messageQ = new Queue('dermail-tx', config.redisQ.port, config.redisQ.host);
var redisStore = redis.createClient(config.redisQ);
var debug = !!config.debug;

var start = function() {
	return new Promise(function(resolve, reject) {
		transporter = nodemailer.createTransport({
			direct: true,
			name: hostname + '.dermail.net'
		})
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

			return enqueue('doSendMail', data)
			.then(function() {
				enqueue('callback', data)
			})
			.then(function() {
				return done();
			})
			.catch(function(e) {
				return done(e);
			})

			break;

			case 'callback':

			try {
				var mail = mailcomposer(data);
				var stream = mail.createReadStream();
				var mailparser = new MailParser({
					streamAttachments: true
				});

				mailparser.on("end", function(message) {
					// dermail-smtp-inbound processMail();
					message.cc = message.cc || [];
					message.attachments = message.attachments || [];
					message.date = message.date.toISOString();
					message.html = message.html || '';

					// Compatibility with MTA-Worker
					message.text = htmlToText.fromString(message.html);

					var myAddress = data.from.address;

					for (key in message.from) {
						if (message.from[key].address == myAddress) {
							delete message.from[key];
						}
					}

					message.remoteSecret = config.remoteSecret;
					message.accountId = data.accountId;
					message.myAddress = myAddress;

					request
					.post(config.tx.hook())
					.timeout(10000)
					.send(message)
					.set('Accept', 'application/json')
					.end(function(err, res){
						if (err) {
							if (debug) console.log(err);
							return done(err);
						}
						if (res.body.ok === true) {
							return enqueue('notify', {
								remoteSecret: config.remoteSecret,
								userId: data.userId,
								level: 'success',
								msg: 'Message saved to Sent folder.'
							})
							.then(function() {
								return done();
							})
							.catch(function(e) {
								console.log(e);
								return done();
							})
						}else{
							if (debug) console.dir(res.body);
							return done(res.body);
						}
					});
				});

				stream.pipe(mailparser);

			}catch(e) {
				return done(e);
			}

			break;

			case 'doSendMail':

			transporter.sendMail(data, function(err, info) {
				if (err) {
					console.log(err);
					return done(err);
				}
				console.log(info);
				return enqueue('notify', {
					remoteSecret: config.remoteSecret,
					userId: data.userId,
					level: 'success',
					msg: 'Message sent by ' + hostname
				})
				.then(function() {
					return done();
				})
				.catch(function(e) {
					console.log(e);
					return done();
				})
			})

			break;

			case 'notify':

			request
			.post(config.tx.notify())
			.timeout(10000)
			.send(data)
			.set('Accept', 'application/json')
			.end(function(err, res){
				if (err) {
					if (debug) console.log(err);
					return done(err);
				}
				if (res.body.ok === true) {
					return done();
				}else{
					if (debug) console.dir(res.body);
					return done(res.body);
				}
			});

			break;
		}
	});
})
.catch(function(e) {
	if (debug) console.log(e);
})
