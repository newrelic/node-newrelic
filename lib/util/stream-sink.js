'use strict';

var events = require('events')
  , util   = require('util')
  ;

/**
 * Pipe a readable stream into this sink that fulfills the Writable Stream
 * contract and the callback will be fired when the stream has been completely
 * read.
 */
function StreamSink(callback) {
  events.EventEmitter.call(this);

  this.callback = callback;
  this.sink = '';
  this.writable = true;

  var self = this;

  this.on('data', function (data) {
    self.sink += data;
  });

  this.on('error', function (exception) {
    self.writable = false;
    self.emit('error', exception);
    return callback(exception);
  });

  this.on('end', function () {
    return callback(null, self.sink);
  });
}
util.inherits(StreamSink, events.EventEmitter);

StreamSink.prototype.write = function (string) {
  this.sink += string;
};

StreamSink.prototype.end = StreamSink.prototype.destroy = function () {
  this.writable = false;
  return this.callback(null, this.sink);
};

module.exports = StreamSink;
