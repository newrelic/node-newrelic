'use strict'

var stringifySync = require('../util/safe-json').stringifySync

module.exports = function initialize(agent, redis, moduleName, shim) {
  var proto = redis && redis.RedisClient && redis.RedisClient.prototype
  if (!proto) {
    return false
  }

  shim.setDatastore(shim.REDIS)
  if (proto.internal_send_command) {
    shim.recordOperation(
      proto,
      'internal_send_command',
      function wrapInternalSendCommand(shim, internal_send_command, name, args) {
        var commandObject = args[0]
        var keys = commandObject.args
        var extras = getInstanceExtras(this)

        if (keys && keys.length > 0) {
          extras.key = stringifySync(keys[0], 'unknown')
        }

        return {
          name: commandObject.command || 'other',
          extras: extras,
          callback: function bindCallback(shim, _f, _n, segment) {
            if (shim.isFunction(commandObject.callback)) {
              shim.bindCallbackSegment(commandObject, 'callback', segment)
            } else {
              var self = this
              commandObject.callback = shim.bindSegment(function __NR_redisCallback(err) {
                if (err && self.emit instanceof Function) {
                  self.emit('error', err)
                }
              }, segment, true)
            }
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
        var extras = getInstanceExtras(this)

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

  function getInstanceExtras(client) {
    if (client.hasOwnProperty('port') && client.hasOwnProperty('host')) {
      // for redis <=0.11
      return doCapture(client)
    } else if (client.hasOwnProperty('connection_options')) {
      // for redis 2.4.0 - 2.6.2
      return doCapture(client.connection_options)
    } else if (client.hasOwnProperty('connectionOption')) {
      // for redis 0.12 - 2.2.5
      return doCapture(client.connectionOption)
    } else if (client.hasOwnProperty('options')) {
      // for redis 2.3.0 - 2.3.1
      return doCapture(client.options)
    }

    shim.logger.debug('Could not access instance attributes on connection.')
    return {
      host: null,
      port_path_or_id: null,
      database_name: null
    }

    function doCapture(opts) {
      var db = (client.hasOwnProperty('selected_db') ? client.selected_db : opts.db) || 0

      return {
        host: opts.host || 'localhost',
        port_path_or_id: opts.path || opts.port || '6379',
        database_name: db
      }
    }
  }
}
