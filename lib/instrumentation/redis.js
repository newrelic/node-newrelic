/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const hasOwnProperty = require('../util/properties').hasOwn
const stringify = require('json-stringify-safe')

module.exports = function initialize(agent, redis, moduleName, shim) {
  const proto = redis && redis.RedisClient && redis.RedisClient.prototype
  if (!proto) {
    return false
  }

  shim.setDatastore(shim.REDIS)
  if (proto.internal_send_command) {
    shim.recordOperation(
      proto,
      'internal_send_command',
      function wrapInternalSendCommand(shim, _, __, args) {
        const commandObject = args[0]
        const keys = commandObject.args
        const parameters = getInstanceParameters(this)

        if (keys && keys.length > 0) {
          try {
            parameters.key = stringify(keys[0])
          } catch (err) {
            shim.logger.debug(err, 'Failed to stringify internal send command redis key')
            parameters.key = '<unknown>'
          }
        }

        return {
          name: commandObject.command || 'other',
          parameters: parameters,
          callback: function bindCallback(shim, _f, _n, segment) {
            if (shim.isFunction(commandObject.callback)) {
              shim.bindCallbackSegment(commandObject, 'callback', segment)
            } else {
              const self = this
              commandObject.callback = shim.bindSegment(
                function NRCallback(err) {
                  if (err && self.emit instanceof Function) {
                    self.emit('error', err)
                  }
                },
                segment,
                true
              )
            }
          }
        }
      }
    )
  } else {
    // For redis versions <2.6.1
    shim.recordOperation(proto, 'send_command', function wrapSendCommand(shim, _, __, args) {
      const keys = args[1]
      const parameters = getInstanceParameters(this)

      if (keys && !shim.isFunction(keys)) {
        try {
          parameters.key = stringify(keys[0])
        } catch (err) {
          shim.logger.debug(err, 'Failed to stringify redis key for send command')
          parameters.key = '<unknown>'
        }
      }

      return {
        name: args[0] || 'other',
        parameters: parameters,
        callback: function bindCallback(shim, _f, _n, segment) {
          const last = args[args.length - 1]
          if (shim.isFunction(last)) {
            shim.bindCallbackSegment(args, shim.LAST, segment)
          } else if (shim.isArray(last) && shim.isFunction(last[last.length - 1])) {
            shim.bindCallbackSegment(last, shim.LAST, segment)
          }
        }
      }
    })
  }

  function getInstanceParameters(client) {
    if (hasOwnProperty(client, 'port') && hasOwnProperty(client, 'host')) {
      // for redis <=0.11
      return doCapture(client)
    } else if (hasOwnProperty(client, 'connection_options')) {
      // for redis 2.4.0 - 2.6.2
      return doCapture(client.connection_options)
    } else if (hasOwnProperty(client, 'connectionOption')) {
      // for redis 0.12 - 2.2.5
      return doCapture(client.connectionOption)
    } else if (hasOwnProperty(client, 'options')) {
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
      const db = (hasOwnProperty(client, 'selected_db') ? client.selected_db : opts.db) || 0

      return {
        host: opts.host || 'localhost',
        port_path_or_id: opts.path || opts.port || '6379',
        database_name: db
      }
    }
  }
}
