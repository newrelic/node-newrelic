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
    this.propagateContext = true
  }

  handler(data, ctx) {
    const { arguments: args, self: client } = data
    // The `command` method takes two arguments: a query generator and a server
    // address. The query generator returns a simple object describing the
    // memcached call. The server parameter is only provided for multi-calls.
    // When not provided, it can be derived from the key being interacted with.
    const metacall = args[0]()
    const server = args[1]
    const keys = this.#wrapKeys(metacall)
    this.parameters = this.#getInstanceParameters({ keys, metacall, server, client })
    // rewrap the metacall for the command object
    metacall.callback = this.#traceMetacallCallback(ctx, metacall.callback)
    args[0] = function rewrapped() {
      return metacall
    }
    this.operation = metacall.type || 'Unknown'
    return super.handler(data, ctx)
  }

  // TODO: repeats code in Subscriber.traceCallback,
  // but has to applied back on the `metacall.callback`,
  // so couldn't use it really
  #traceMetacallCallback(context, callback) {
    if (typeof callback !== 'function') {
      this.logger.trace('Callback is not present, not wrapping')
      return
    }

    const { asyncStart, asyncEnd, error } = this.channel
    function wrappedCallback(err, res) {
      // assigning a boolean to the context so we know that the
      // `error`, `asyncStart`, and `asyncEnd` are coming from the wrapped callback
      context.callback = true
      if (err) {
        context.error = err
        error.publish(context)
      } else {
        context.result = res
      }

      // Using runStores here enables manual context failure recovery
      asyncStart.runStores(context, () => {
        try {
          if (callback) {
            const cbResult = Reflect.apply(callback, this, arguments)
            context.cbResult = cbResult
            return cbResult
          }
        } finally {
          asyncEnd.publish(context)
        }
      })
    }
    return wrappedCallback
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
