/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const createFormatter = require('@newrelic/winston-enricher')

module.exports = function instrument(agent, winston, _, shim) {
  // create an instrumented formatter to enrich and report logs
  const instrumentedFormatter = createFormatter({ ...agent, shim })
  // reusable function to update instantiation options with our formatter
  function updateOptsFormatters(opts = {}) {
    if ('format' in opts) {
      opts.format = winston.format.combine(opts.format, instrumentedFormatter)
    } else {
      opts.format = instrumentedFormatter
    }
    return opts
  }
  // wrap logger creation to combine or insert our formatter
  shim.wrap(winston, 'createLogger', function wrapCreate(shim, createLogger) {
    return function createWrappedLogger(opts = {}) {
      opts = updateOptsFormatters(opts)
      return createLogger(opts)
    }
  })
  // wrap transport creation to insert our formatter
  shim.wrap(winston, 'transports', function wrapTransports(shim, transports) {
    const proxyTransports = new Proxy(transports, {
      get(target, prop) {
        const Transport = target[prop]
        if (typeof Transport !== 'function') {
          return Transport
        }
        return class WrappedTransport extends Transport {
          constructor(opts = {}) {
            opts = updateOptsFormatters(opts)
            super(opts)
          }
        }
      }
    })
    return proxyTransports
  })
}
