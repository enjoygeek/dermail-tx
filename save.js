var Stream = require('stream').PassThrough;
var util = require('util');
var tmp = require('tmp');
var fs = require('fs');

function saveStream(options) {
	this.options = options || {};
	Stream.call(this);

	this.writable = true;
	this.readble = true;

	this.callback = options.callback;
	this.message = options.message;
    this.saveCb = options.saveCb
    this.tmp = tmp.fileSync();
    this.fs = fs.createWriteStream(this.tmp.name);
}
util.inherits(saveStream, Stream);

saveStream.prototype._write = function(buf, enc, cb) {
    this.emit('data', buf);
    this.fs.write(buf, 'utf-8', function() {
        process.nextTick(cb)
    })
};

saveStream.prototype._flush = function(cb) {
    process.nextTick(function() {
        this.fs.end()
    	this.callback();
        this.saveCb(this.tmp)
    	this.emit('end');
    }.bind(this))
}

module.exports.save = function(options) {
	return function(mail, callback) {
		options.message = mail.message;
		options.callback = callback;
		var stream = mail.message.createReadStream();
		var sign = new saveStream(options);
		stream.pipe(sign);
	};
};
