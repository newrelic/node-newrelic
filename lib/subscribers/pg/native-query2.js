/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const PgQuerySubscriber = require('./query.js')

/**
 * Subscribes to the `query` event for PostgreSQL's (`pg-native`) `Client` class
 * (`pg-native/index.js`).
 *
 * This class is only for maintaining context and creating the correct
 * segment when a user passes in a `Query object` (EventEmitter) as
 * the argument.
 *
 * If a promise or callback is passed in, nothing happens other than
 * unnecessary context propagation.
 */
class PgNativeQuery2Subscriber extends PgQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_nativeQuery2', packageName = 'pg-native' }) {
    super({ agent, logger, channelName, packageName })
    this.events = ['asyncStart', 'asyncEnd']
    this.propagateTx = true
  }

  /**
   * @override
   * @param {object} data event data
   * @param {*} ctx our context
   */
  handler(data, ctx) {
    if (ctx?._extras.isEE) {
      this.queryString = this.getQuery(data?.arguments)
      this.setParameters(data?.self)
      return super.handler(data, ctx)
    }
  }

  // This explicit context propagation is necessary when
  // the user passes in a Query object (EventEmitter) as
  // the argument.
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

module.exports = PgNativeQuery2Subscriber
