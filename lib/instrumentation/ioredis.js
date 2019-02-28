'use strict'

var stringify = require('json-stringify-safe')
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
    var parameters = {
      host: this.connector.options.host,
      port_path_or_id: this.connector.options.port
    }

    var keys = command.args
    if (keys && typeof keys !== 'function') {
      var src = Object.create(null)
      try {
        src.key = stringify(keys[0])
      } catch (err) {
        shim.logger.debug(err, 'Failed to stringify ioredis key')
        src.key = '<unknown>'
      }
      urltils.copyParameters(src, parameters)
    }

    return {
      name: (command.name || 'unknown'),
      parameters: parameters,
      promise: true
    }
  }
}
