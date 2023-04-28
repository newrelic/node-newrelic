/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../../logger').child({ component: 'nestjs' })

module.exports = function initialize(agent, core, moduleName, shim) {
  shim.setFramework(shim.NEST)
  shim.wrap(core.BaseExceptionFilter.prototype, 'handleUnknownError', (shim, original) => {
    return function wrappedHandleUnknownError(exception) {
      const { transaction } = shim.getActiveSegment()
      if (transaction) {
        shim.agent.errors.add(transaction, exception)
        logger.trace(exception, 'Captured error handled by Nest.js exception filter.')
      } else {
        logger.trace(
          exception,
          'Ignoring error handled by Nest.js exception filter: not in a transaction'
        )
      }

      return original.apply(this, arguments)
    }
  })
}
