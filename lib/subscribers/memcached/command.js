/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DbOperationSubscriber = require('../db-operation')
const stringify = require('json-stringify-safe')

module.exports = class CommandSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_command', packageName: 'memcached', system: 'Memcache' })
    this.events = ['end']
  }

  handler(data, ctx) {
    const { arguments: args, self: client } = data
    // The `command` method takes two arguments: a query generator and a server
    // address. The query generator returns a simple object describing the
    // memcached call. The server parameter is only provided for multi-calls.
    // When not provided, it can be derived from the key being interacted with.
    const [queryCompiler, server] = args
    const metacall = queryCompiler()
    this.parameters = this.#getInstanceParameters({ keys: this.#wrapKeys(metacall), metacall, server, client })
    this.operation = metacall.type || 'Unknown'
    const newCtx = super.handler(data, ctx)
    metacall.callback = this.agent.tracer.bindFunction(metacall.callback, newCtx, true)
    args[0] = function rewrapped() {
      // we wrap the queryCompiler function to return the
      // updated `metacall` object with our callback
      return metacall
    }
    return newCtx
  }

  #getInstanceParameters({ keys, metacall, server, client }) {
    const parameters = {}
    try {
      parameters.key = stringify(keys[0])
    } catch (err) {
      this.logger.debug(err, 'Unable to stringify memcache key')
      parameters.key = '<unknown>'
    }

    // Capture connection info for datastore instance metric.
    let location = null
    if (typeof server === 'string') {
      location = server
    } else if (client.HashRing && client.HashRing.get && metacall.key) {
      location = client.HashRing.get(metacall.key)
    }
    if (location) {
      location = location.split(':')
      parameters.host = location[0]
      parameters.port_path_or_id = location[1]
    }
    return parameters
  }

  #wrapKeys(metacall) {
    if (metacall.key) {
      return [metacall.key]
    } else if (metacall.multi) {
      return metacall.command.split(' ').slice(1)
    }

    return []
  }
}
