/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const hasOwnProperty = require('../util/properties').hasOwn
const stringify = require('json-stringify-safe')

module.exports = function initialize(_agent, redis, _moduleName, shim) {
  const proto = redis?.RedisClient?.prototype
  if (!proto) {
    return false
  }

  shim.setDatastore(shim.REDIS)

  if (proto.internal_send_command) {
    registerInternalSendCommand(shim, proto)
  } else {
    registerSendCommand(shim, proto)
  }
}

/**
 * Instrumentation used in versions of redis > 2.6.1 < 4 to record all redis commands
 *
 * @param {Shim} shim instance of shim
 * @param {object} proto RedisClient prototype
 */
function registerInternalSendCommand(shim, proto) {
  shim.recordOperation(
    proto,
    'internal_send_command',
    function wrapInternalSendCommand(shim, _, __, args) {
      const commandObject = args[0]
      const keys = commandObject.args
      const parameters = getInstanceParameters(shim, this)

      parameters.key = stringifyKeys(shim, keys)

      return {
        name: commandObject.command || 'other',
        parameters,
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
}

/**
 * Instrumentation used in versions of redis < 2.6.1 to record all redis commands
 *
 * @param {Shim} shim instance of shim
 * @param {object} proto RedisClient prototype
 */
function registerSendCommand(shim, proto) {
  shim.recordOperation(proto, 'send_command', function wrapSendCommand(shim, _, __, args) {
    const [command, keys] = args
    const parameters = getInstanceParameters(shim, this)

    parameters.key = stringifyKeys(shim, keys)

    return {
      name: command || 'other',
      parameters,
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

function stringifyKeys(shim, keys) {
  let key = null
  if (keys && keys.length && !shim.isFunction(keys)) {
    try {
      key = stringify(keys[0])
    } catch (err) {
      shim.logger.debug(err, 'Failed to stringify redis key for send command')
      key = '<unknown>'
    }
  }

  return key
}

/**
 * Captures the necessary datastore parameters based on the specific version of redis
 *
 * @param {Shim} shim instance of shim
 * @param {object} client instance of redis client
 * @returns {object} datastore parameters
 */
function getInstanceParameters(shim, client) {
  if (hasOwnProperty(client, 'connection_options')) {
    // for redis 2.4.0 - 2.6.2
    return doCapture(client, client.connection_options)
  } else if (hasOwnProperty(client, 'connectionOption')) {
    // for redis 0.12 - 2.2.5
    return doCapture(client, client.connectionOption)
  } else if (hasOwnProperty(client, 'options')) {
    // for redis 2.3.0 - 2.3.1
    return doCapture(client, client.options)
  }
  shim.logger.debug('Could not access instance attributes on connection.')
  return doCapture()
}

/**
 * Extracts the relevant datastore parameters
 *
 * @param {object} client instance of redis client
 * @param {object} opts options for the client instance
 * @returns {object} datastore parameters
 */
function doCapture(client = {}, opts = {}) {
  return {
    host: opts.host || 'localhost',
    port_path_or_id: opts.path || opts.port || '6379',
    database_name: client.selected_db || opts.db || 0
  }
}
