/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { INSTRUMENTED_METHODS, RESOLVE_METHODS } = require('./constants')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const BaseCoreSubscriber = require('../base')
const shimmer = require('#agentlib/shimmer.js')

class DnsPromisesSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'dns', prefix: 'promises', instrumentedMethods: INSTRUMENTED_METHODS })
  }

  instrument(dns) {
    const self = this
    shimmer.wrapMethod(dns.promises, 'dns', INSTRUMENTED_METHODS, function wrapMethod(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedMethod(...args) {
        const data = { name: `${self.packageName}.${method}` }
        return channel.tracePromise(original, data, this, ...args)
      }
    })
    shimmer.wrapMethod(dns.promises.Resolver.prototype, 'dns', RESOLVE_METHODS, function wrapMethod(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedMethod(...args) {
        const data = { name: `${self.packageName}.${method}` }
        return channel.tracePromise(original, data, this, ...args)
      }
    })
  }
}

module.exports = DnsPromisesSubscriber
