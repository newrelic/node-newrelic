'use strict'

var stringifySync = require('../util/safe-json').stringifySync

module.exports = function initialize(agent, redis, moduleName, shim) {
  var proto = redis && redis.RedisClient && redis.RedisClient.prototype
  if (!proto) {
    return
  }

  shim.setDatastore(shim.REDIS)
  if (proto.internal_send_command) {
    shim.recordOperation(
      proto,
      'internal_send_command',
      function wrapInternalSendCommand(shim, internal_send_command, name, args) {
        var commandObject = args[0]
        var keys = commandObject.args
        var extras = {
          host: this.host,
          port: this.port
        }

        if (keys && keys.length > 0) {
          extras.key = stringifySync(keys[0], 'unknown')
        }

        return {
          name: commandObject.command || 'other',
          extras: extras,
          callback: function bindCallback(shim, _f, _n, segment) {
            shim.bindCallbackSegment(commandObject, 'callback', segment)
          }
        }
      }
    )
  } else {
    // For redis versions <2.6.1
    shim.recordOperation(
      proto,
      'send_command',
      function wrapSendCommand(shim, send_command, name, args) {
        var keys = args[1]
        var extras = {
          host: this.host,
          port: this.port
        }

        if (keys && !shim.isFunction(keys)) {
          extras.key = stringifySync(keys[0], 'unknown')
        }

        return {
          name: args[0] || 'other',
          extras: extras,
          callback: function bindCallback(shim, _f, _n, segment) {
            var last = args[args.length - 1]
            if (shim.isFunction(last)) {
              shim.bindCallbackSegment(args, shim.LAST, segment)
            } else if (shim.isArray(last) && shim.isFunction(last[last.length - 1])) {
              shim.bindCallbackSegment(last, shim.LAST, segment)
            }
          }
        }
      }
    )
  }
}
