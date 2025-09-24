/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbOperationSubscriber = require('../db-operation.js')
const { POSTGRES } = require('#agentlib/metrics/names.js')

/**
 * Subscribes to the `connect` event for PostgreSQL's (`pg`) `Client` class.
 */
class PgConnectSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger, channelName = 'nr_connect', packageName = 'pg' }) {
    super({ agent, logger, channelName, packageName, system: POSTGRES.PREFIX })
    this.events = ['asyncStart', 'asyncEnd']
    this.operation = 'connect'
    this.callback = -1
    this.propagateTx = true
  }

  setParameters(client) {
    this.parameters = {}
    this.parameters.product = this.system
    this.parameters.database_name = client?.database
    this.parameters.host = client?.host
    this.parameters.port_path_or_id = client?.port
  }

  handler(data, ctx) {
    this.setParameters(data?.self)
    return super.handler(data, ctx)
  }

  enable() {
    super.enable()
    this.channel.asyncStart.bindStore(this.store, (data) => {
      const { transaction, segment } = data
      const ctx = this.agent.tracer.getContext()

      if (!(transaction && segment)) {
        this.logger.trace('No active transaction/segment, returning existing context')
        return ctx
      }
      const newCtx = ctx.enterSegment({ transaction, segment })
      return newCtx
    })
  }

  disable() {
    super.disable()
    this.channel.asyncStart.unbindStore(this.store)
  }
}

module.exports = PgConnectSubscriber
