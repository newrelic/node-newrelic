'use strict'

var stringifySync = require('../util/safe-json').stringifySync
var urltils = require('../util/urltils.js')


module.exports = function initialize(agent, redis, moduleName, shim) {
  var proto = redis && redis.prototype
  if (!proto) {
    return false
  }

  shim.setDatastore(shim.REDIS)
  shim.recordOperation(proto, 'sendCommand', wrapSendCommand)

  function wrapSendCommand(shim, original, name, args) {
    var command = args[0]

    // TODO: Instance attributes for ioredis
    var extras = {
      host: this.connector.options.host,
      port_path_or_id: this.connector.options.port
    }

    var keys = command.args
    if (keys && typeof keys !== 'function') {
      urltils.copyParameters(agent.config,
        {key: stringifySync(keys[0], 'Unknown')}, extras)
    }

    return {
      name: (command.name || 'unknown'),
      extras: extras,
      callback: function bindCallback(shim, _f, _n, segment) {
        // record duration when promise resolves
        command.promise.finally(function cb_resolved() {
          segment.touch()
        })
      }
    }
  }
}
