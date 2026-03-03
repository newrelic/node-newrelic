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
      channelName: 'nr_unknown_error',
      ...rest
    })
  }

  // eslint-disable-next-line sonarjs/no-invariant-returns
  handler(data, ctx) {
    const { arguments: args } = data
    const { transaction } = ctx
    const exception = args[0]

    if (!transaction) {
      this.logger.trace(
        exception,
        'Ignoring error handled by Nest.js exception filter: not in a transaction'
      )
      return ctx
    }

    this.logger.trace(exception, 'Captured error handled by Nest.js exception filter.')
    this.agent.errors.add(transaction, exception)
    return ctx
  }
}
