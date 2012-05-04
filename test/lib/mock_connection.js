var events = require('events')
  , util   = require('util')
  , path   = require('path')
  , logger = require(path.join(__dirname, '..', '..', 'lib', 'logger'))
  ;

function MockConnection() {
  events.EventEmitter.call(this);

  this.connect = function () { logger.debug('nope, not connecting.'); };
  this.isConnected = function () { return false; };
}
util.inherits(MockConnection, events.EventEmitter);

exports.Connection = MockConnection;
