/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const stringify = require('json-stringify-safe')
const urltils = require('../util/urltils.js')
const {
  OperationSpec,
  params: { DatastoreParameters }
} = require('../../lib/shim/specs')

module.exports = function initialize(agent, redis, moduleName, shim) {
  const proto = redis && redis.prototype
  if (!proto) {
    return false
  }

  shim.setDatastore(shim.REDIS)
  shim.recordOperation(proto, 'sendCommand', wrapSendCommand)

  function wrapSendCommand(shim, original, name, args) {
    const command = args[0]

    const parameters = new DatastoreParameters({
      host: this.connector.options.host,
      port_path_or_id: this.connector.options.port
    })

    const keys = command.args
    if (keys && typeof keys !== 'function') {
      const src = Object.create(null)
      try {
        src.key = stringify(keys[0])
      } catch (err) {
        shim.logger.debug(err, 'Failed to stringify ioredis key')
        src.key = '<unknown>'
      }
      urltils.copyParameters(src, parameters)
    }

    return new OperationSpec({
      name: command.name || 'unknown',
      parameters,
      promise: true
    })
  }
}
