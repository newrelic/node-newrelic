/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const createFormatter = require('@newrelic/winston-enricher/lib/createFormatter')
const API = require('../../api')

module.exports = function instrument(agent, winston, _, shim) {
  // create an instrumented formatter to enrich and report logs
  const api = new API(agent)
  api.shim = shim
  const instrumentedFormatter = createFormatter(api)

  // wrap logger creation to combine or insert our formatter
  shim.wrap(winston, 'createLogger', function wrapCreate(shim, createLogger) {
    return function createWrappedLogger(opts = {}) {
      // combine top-level formatter with our own
      if ('format' in opts) {
        opts.format = winston.format.combine(opts.format, instrumentedFormatter())
      } else {
        opts.format = instrumentedFormatter()
      }

      // combine transport-level formatters with our own
      if ('transports' in opts) {
        opts.transports = opts.transports.map((transport) => {
          if (transport.format) {
            transport.format = winston.format.combine(transport.format, instrumentedFormatter())
          }
          return transport
        })
      }

      return createLogger(opts)
    }
  })
}
