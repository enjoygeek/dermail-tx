var os = require('os'),
	Queue = require('bull'),
	redis = require('redis'),
	config = require('./config'),
	Promise = require('bluebird'),
	request = require('superagent'),
    nodemailer = require('nodemailer'),
	MailParser = require("mailparser").MailParser,
	htmlToText = require('html-to-text'),
	hostname = os.hostname(),
	fs = Promise.promisifyAll(require('fs')),
	bunyan = require('bunyan'),
	stream = require('gelf-stream'),
	log,
    tx;

Promise.promisifyAll(redis.RedisClient.prototype);

var messageQ = new Queue('dermail-tx', config.redisQ.port, config.redisQ.host);
var redisStore = redis.createClient(config.redisQ);

if (!!config.graylog) {
	log = bunyan.createLogger({
		name: 'TX-Worker',
		streams: [{
			type: 'raw',
			stream: stream.forBunyan(config.graylog.host, config.graylog.port)
		}]
	});
}else{
	log = bunyan.createLogger({
		name: 'TX-Worker'
	});
}

var start = function() {
	return new Promise(function(resolve, reject) {
		request
		.post(config.tx.setup())
		.timeout(10000)
		.set('X-remoteSecret', config.remoteSecret)
		.send({})
		.set('Accept', 'application/json')
		.end(function(err, res){
			if (err) {
				return reject(err);
			}
			if (res.body.ok !== true) {
				return reject(new Error('Cannot get S3 credentials.'));
			}

			tx = res.body;

			log.info('Process ' + process.pid + ' is running as an TX-Worker.');
			return resolve(tx);
		});
	});
}

var enqueue = function(type, payload) {
	return messageQ.add({
		type: type,
		payload: payload
	}, config.Qconfig)
    .catch(function(e) {
        log.error({ message: 'Error trying to enqueue. Automatic retry is disabled', type: type, payload: payload})
    })
}

start()
.then(function(tx) {
	messageQ.process(3, function(job, done) {

		var data = job.data;
		var type = data.type;
		data = data.payload;

		log.info({ message: 'Received Job: ' + type, payload: data });

		var callback = function(e) {
			if (e) {
				log.error({ message: 'Job ' + type + ' returns an error.', error: e });
			}
			return done(e);
		}

		switch (type) {
			case 'sendMail':

            try {
				var mailparser = new MailParser({
					streamAttachments: true
				});
                var parseStream = request.get(data.url);
                parseStream.on('error', function(e) {
                    log.error({ message: 'Create parse stream in sendMail throws an error', error: '[' + e.name + '] ' + e.message, stack: e.stack });
                    return callback(e);
                })

                mailparser.on("end", function(message) {
					// dermail-smtp-inbound processMail();
					message.cc = message.cc || [];
					message.bcc = message.bcc || [];
					message.attachments = message.attachments || [];
					message.date = message.date.toISOString();
					message.html = message.html || '';

					// Compatibility with MTA-Worker
					message.text = htmlToText.fromString(message.html);

					message.accountId = data.accountId;
                    message.userId = data.userId;

                    message.connection = {
                        tmpPath: data.tmpPath
                    };

					// Extra data to help with remote debugging
					message.TXExtra = {
						attemptsMade: job.attemptsMade,
						maxAttempts: job.attempts,
						delay: job.delay,
						jobId: job.jobId
					};

                    var readStream = request.get(data.url);
                    readStream.on('error', function(e) {
                        log.error({ message: 'Create read stream in sendMail throws an error', error: '[' + e.name + '] ' + e.message, stack: e.stack });
                        return callback(e);
                    })

                    var writeStream = fs.createWriteStream(data.tmpPath);
                    writeStream.on('error', function(e) {
                        log.error({ message: 'Create write stream in sendMail throws an error', error: '[' + e.name + '] ' + e.message, stack: e.stack });
                        return callback(e);
                    })

                    writeStream.on('finish', function() {
                        enqueue('doSendMail', {
                            userId: data.userId,
                            tmpPath: data.tmpPath,
                            sendOptions: {
                                to: message.to,
                                from: message.from,
                                cc: message.cc,
                                bcc: message.bcc,
                                raw: {
                                    path: data.tmpPath
                                }
                            }
                        })
            			.then(function() {
            				return enqueue('callback', message)
            			})
            			.then(function() {
            				return callback();
            			})
                    })

                    readStream.pipe(writeStream)
                })

                parseStream.pipe(mailparser);
            } catch(e) {
                log.error({ message: 'Error composing email to be saved. Automatic retry is disabled', error: e })
				return callback();
            }

			break;

			case 'callback':

            request
            .post(config.tx.hook())
            .timeout(10000)
            .set('X-remoteSecret', config.remoteSecret)
            .send(data)
            .set('Accept', 'application/json')
            .end(function(err, res){
                if (err) {
                    log.error({ message: 'Error trying to save sent email. Automatic retry is disabled', error: err.response})
                    return callback();
                }
                if (res.body.ok === true) {
                    return enqueue('notify', {
                        userId: data.userId,
                        level: 'success',
                        msg: 'Message saved to Sent folder.'
                    })
                    .then(function() {
                        return callback();
                    })
                }else{
                    log.error({ message: 'Error trying to save sent email. Automatic retry is disabled', error: res.body })
                    return callback();
                }
            });

			break;

			case 'doSendMail':

			var transporter = nodemailer.createTransport({
				direct: true,
				name: hostname + '.' + tx.domainName
			});

			transporter.sendMail(data.sendOptions, function(err, info) {
				if (err) {
					log.error({ message: 'Transporter sendMail returns an error. Automatic retry is disabled', info: err.errors })
					return callback();
				}

				log.info({ message: 'Outbound status', info: info });

                var returnLevel = 'success';
                var returnMsg = 'Message sent by ' + hostname;

				if (info.accepted.length === 0 && info.pending.length > 0) {
					// Possibly greylisted
                    if (info.pending.reduce(function(yes, each) {
                        if (each.response && each.response.toLowerCase().indexOf('greylist') !== -1) yes = true;
                        return yes;
                    }, false)) {
                        // indeed greylisted
                        return callback(new Error('Greylisted, will try again later'));
                    }
				}else if (info.rejected.length > 0) {
                    returnLevel = 'error';
                    returnMsg = 'Rejected. Please check logs for details.'
                }

                return fs.unlinkAsync(data.tmpPath).catch(function(e) {
                    log.error({ message: 'Error trying to remove TX raw', error: e })
                })
                .then(function() {
                    return enqueue('notify', {
    					userId: data.userId,
    					level: returnLevel,
    					msg: returnMsg
    				})
                })
				.then(function() {
					return callback();
				})
			})

			break;

			case 'notify':

			request
			.post(config.tx.notify())
			.timeout(10000)
			.set('X-remoteSecret', config.remoteSecret)
			.send(data)
			.set('Accept', 'application/json')
			.end(function(err, res){
				if (err) {
                    log.error({ message: 'Error trying to notify. Automatic retry is disabled', error: err.response})
					return callback();
				}
				if (res.body.ok === true) {
					return callback();
				}else{
                    log.error({ message: 'Error trying to notify. Automatic retry is disabled', error: res.body})
					return callback();
				}
			});

			break;
		}
	});
})
.catch(function(e) {
	log.error(e);
})
