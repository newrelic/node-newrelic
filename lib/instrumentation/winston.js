/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const createFormatter = require('@newrelic/winston-enricher/lib/createFormatter')
const API = require('../../api')

module.exports = function instrument(agent, winston, _, shim) {
  const config = agent.config
  if (
    !(
      config.application_logging.enabled &&
      (config.application_logging.forwarding.enabled ||
        config.application_logging.metrics.enabled ||
        config.application_logging.local_decorating.enabled)
    )
  ) {
    shim.logger.debug('Application logging not enabled. Not instrumenting winston...')
    return
  }

  // create an instrumented formatter to enrich and report logs
  const api = new API(agent)
  api.shim = shim
  const instrumentedFormatter = createFormatter(api, winston)

  // wrap logger creation to combine or insert our formatter
  shim.wrap(winston, 'createLogger', function wrapCreate(shim, createLogger) {
    return function createWrappedLogger() {
      const args = shim.argsToArray.apply(shim, arguments)
      const opts = args[0]
      if (!shim.isObject(opts)) {
        return createLogger.apply(this, args)
      }
      if ('transports' in opts) {
        // combine transport-level formatters with our own
        opts.transports = opts.transports.map((transport) => {
          if (transport.format) {
            transport.format = winston.format.combine(transport.format, instrumentedFormatter())
          } else {
            transport.format = instrumentedFormatter()
          }
          return transport
        })
      } else if ('format' in opts) {
        // combine top-level formatter with our own
        opts.format = winston.format.combine(opts.format, instrumentedFormatter())
      } else {
        opts.format = instrumentedFormatter()
      }

      return createLogger.apply(this, args)
    }
  })
}
