/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const PgQuerySubscriber = require('./query.js')

/**
 * Subscribes to the `query` event for PostgreSQL's (`pg`) native `Client` class.
 */
class PgNativeQuerySubscriber extends PgQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_nativeQuery' }) {
    super({ agent, logger, channelName })
    this.events = ['asyncStart', 'asyncEnd']
    this.propagateTx = true
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

module.exports = PgNativeQuerySubscriber
