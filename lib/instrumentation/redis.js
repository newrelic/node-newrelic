/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const stringify = require('json-stringify-safe')
const {
  OperationSpec,
  params: { DatastoreParameters }
} = require('../shim/specs')

module.exports = function initialize(_agent, redis, _moduleName, shim) {
  const proto = redis?.RedisClient?.prototype
  if (!proto) {
    shim.logger.warn('Skipping redis instrumentation due to unrecognized module shape')
    return false
  }

  shim.setDatastore(shim.REDIS)

  if (!proto.internal_send_command) {
    shim.logger.warn(
      'New Relic Node.js agent no longer supports redis < 2.6.0, current version %s. Please downgrade to v11 for support, if needed',
      shim.pkgVersion
    )
    return
  }

  registerInternalSendCommand(shim, proto)
}

/**
 * Instrumentation used in versions of redis >= 2.6.0 < 4 to record all redis commands
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
      const parameters = getInstanceParameters(this)

      parameters.key = stringifyKeys(shim, keys)

      return new OperationSpec({
        name: commandObject.command || 'other',
        parameters,
        callback: function bindCallback(shim, _f, _n, segment) {
          if (shim.isFunction(commandObject.callback)) {
            shim.bindCallbackSegment(null, commandObject, 'callback', segment)
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
      })
    }
  )
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
 * Captures the necessary datastore parameters from redis client
 *
 * @param {object} client instance of redis client
 * @returns {object} datastore parameters
 */
function getInstanceParameters(client = {}) {
  const opts = client?.connection_options

  return new DatastoreParameters({
    host: opts.host || 'localhost',
    port_path_or_id: opts.path || opts.port || '6379',
    database_name: client.selected_db || opts.db || 0
  })
}
