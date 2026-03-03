/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')

module.exports = class BaseExceptionFilterSubscriber extends Subscriber {
  constructor({ agent, logger, ...rest }) {
    super({
      agent,
      logger,
      packageName: '@nestjs/core',
      channelName: 'nr_nestjs_unknown_error',
      ...rest
    })
  }

  handler(data) {
    const { arguments: args } = data
    const exception = args[0]

    const tx = this.agent.tracer.getTransaction()
    if (!tx) {
      this.logger.trace(
        exception,
        'Ignoring error handled by Nest.js exception filter: not in a transaction'
      )
      return
    }

    this.logger.trace(exception, 'Captured error handled by Nest.js exception filter.')
    this.agent.errors.add(tx, exception)
  }
}
