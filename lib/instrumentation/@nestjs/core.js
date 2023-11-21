/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../../logger').child({ component: 'nestjs' })
const semver = require('semver')

module.exports = function initialize(agent, core, moduleName, shim) {
  const nestJsVersion = shim.pkgVersion
  shim.setFramework(shim.NEST)
  // Earliest version that runs in the tests
  if (semver.lt(nestJsVersion, '8.0.0')) {
    logger.debug(
      `Not instrumenting Nest.js version ${nestJsVersion}; minimum instrumentable version is 8.0.0`
    )
    return
  }

  shim.wrap(core.BaseExceptionFilter.prototype, 'handleUnknownError', (shim, original) => {
    return function wrappedHandleUnknownError(exception) {
      const segment = shim.getActiveSegment()
      const transaction = segment?.transaction
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
