'use strict';

var EventEmitter = require('events').EventEmitter
  , util         = require('util')
  ;

/**
 * Pipe a readable stream into this sink that fulfills the Writable Stream
 * contract and the callback will be fired when the stream has been completely
 * read.
 */
function StreamSink(callback) {
  EventEmitter.call(this);

  this.callback = callback;
  this.sink = '';
  this.writable = true;

  var sink = this;
  this.on('error', function (error) {
    sink.writable = false;
    callback(error);
  });
}
util.inherits(StreamSink, EventEmitter);

StreamSink.prototype.write = function (string) {
  if (!this.writable) {
    this.emit('error', new Error("Sink no longer writable!"));
    return false;
  }

  this.sink += string;

  return true;
};

StreamSink.prototype.end = function () {
  this.writable = false;

  this.callback(null, this.sink);
};

StreamSink.prototype.destroy = function () {
  this.emit('close');
  this.writable = false;

  delete this.sink;
};

module.exports = StreamSink;
