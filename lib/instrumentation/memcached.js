/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const stringify = require('json-stringify-safe')

function wrapKeys(metacall) {
  if (metacall.key) {
    return [metacall.key]
  } else if (metacall.multi) {
    return metacall.command.split(' ').slice(1)
  }

  return []
}

/**
 * Thanks to Hernan Silberman!
 *
 * instrument the memcached driver to intercept calls and keep stats on them.
 *
 * @param agent
 * @param memcached
 * @param moduleName
 * @param shim
 */
module.exports = function initialize(agent, memcached, moduleName, shim) {
  const proto = memcached && memcached.prototype
  if (!proto) {
    return false
  }

  shim.setDatastore(shim.MEMCACHED)
  shim.recordOperation(proto, 'command', function commandWrapper(shim, original, name, args) {
    // The `command` method takes two arguments: a query generator and a server
    // address. The query generator returns a simple object describing the
    // memcached call. The server parameter is only provided for multi-calls.
    // When not provided, it can be derived from the key being interacted with.
    const metacall = args[0]()
    const server = args[1]
    const keys = wrapKeys(metacall)
    const parameters = Object.create(null)
    try {
      parameters.key = stringify(keys[0])
    } catch (err) {
      shim.logger.debug(err, 'Unable to stringify memcache key')
      parameters.key = '<unknown>'
    }

    // Capture connection info for datastore instance metric.
    let location = null
    if (typeof server === 'string') {
      location = server
    } else if (this.HashRing && this.HashRing.get && metacall.key) {
      location = this.HashRing.get(metacall.key)
    }
    if (location) {
      location = location.split(':')
      parameters.host = location[0]
      parameters.port_path_or_id = location[1]
    }

    // rewrap the metacall for the command object
    args[0] = function rewrapped() {
      return metacall
    }

    // finally, execute the original command
    return {
      name: metacall.type || 'Unknown',
      callback: function wrapCallback(shim, fn, fnName, opSegment) {
        shim.bindCallbackSegment(metacall, 'callback', opSegment)
      },
      parameters: parameters
    }
  })
}
