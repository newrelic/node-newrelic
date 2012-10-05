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

  this.on('error', function () { this.writable = false; }.bind(this));
}
util.inherits(StreamSink, events.EventEmitter);

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
