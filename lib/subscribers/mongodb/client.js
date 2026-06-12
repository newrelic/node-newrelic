/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')

const {
  MONGODB: MONGODB_METRIC_CONSTANTS
} = require('#agentlib/metrics/names.js')

/**
 * Used to patch `MongoClient.prototype.connect` to register a `commandStarted`
 * handler which will attach normalized connection details to the instance.
 * We use these details to provide useful information in trace segments.
 *
 * @type {ClientSubscriber}
 */
module.exports = class ClientSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_client',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })

    this.requireActiveTx = false
  }

  handler(data, ctx) {
    const { self: mongoClient } = data

    if (mongoClient.listenerCount('commandStarted', cmdStartedHandler) === 0) {
      mongoClient.monitorCommands = true
      mongoClient.on('commandStarted', cmdStartedHandler)
    }

    return ctx

    function cmdStartedHandler(event) {
      if (Object.hasOwn(event, 'connectionId') === false) {
        return
      }

      const address = event.address
      const lastColon = address.lastIndexOf(':')
      let host = address.slice(0, lastColon)
      const port = address.slice(lastColon + 1)

      if (['127.0.0.1', '::1', '[::1]'].includes(host)) {
        host = 'localhost'
      }

      mongoClient[Symbol.for('nr.mongo.ctx')] = {
        host,
        port,
        databaseName: event.databaseName
      }
    }
  }
}
