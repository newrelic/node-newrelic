/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseCoreSubscriber = require('../base')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const shimmer = require('#agentlib/shimmer.js')
const { INSTRUMENTED_METHODS, RESOLVE_METHODS } = require('./constants')

class DnsSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'dns', hasCallback: true, instrumentedMethods: INSTRUMENTED_METHODS })
  }

  instrument(dns) {
    const self = this
    shimmer.wrapMethod(dns, 'dns', INSTRUMENTED_METHODS, function wrapMethod(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedMethod(...args) {
        const callback = args.at(-1)
        const callbackName = callback?.name || '<anonymous>'
        const data = { name: `${self.packageName}.${method}`, callbackName }
        return channel.traceCallback(original, -1, data, this, ...args)
      }
    })
    shimmer.wrapMethod(dns.Resolver.prototype, 'dns', RESOLVE_METHODS, function wrapMethod(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedMethod(...args) {
        const callback = args.at(-1)
        const callbackName = callback?.name || '<anonymous>'
        const data = { name: `${self.packageName}.${method}`, callbackName }
        return channel.traceCallback(original, -1, data, this, ...args)
      }
    })
  }
}

module.exports = DnsSubscriber
