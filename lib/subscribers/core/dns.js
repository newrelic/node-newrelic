/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseCoreSubscriber = require('./base')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const shimmer = require('#agentlib/shimmer.js')
const RESOLVE_METHODS = [
  'resolve',
  'resolve4',
  'resolve6',
  'resolveAny',
  'resolveCaa',
  'resolveCname',
  'resolveMx',
  'resolveNaptr',
  'resolveNs',
  'resolvePtr',
  'resolveSoa',
  'resolveSrv',
  'resolveTlsa', // added in Node.js 22.15.0; `shimmer.wrapMethod` skips it on older versions
  'resolveTxt'
]
// `Resolver.prototype` has every method except `lookup`
const RESOLVER_PROTOTYPE_METHODS = [
  'reverse',
  ...RESOLVE_METHODS
]
const INSTRUMENTED_METHODS = [
  'lookup',
  ...RESOLVER_PROTOTYPE_METHODS
]

class DnsSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'dns', instrumentedMethods: INSTRUMENTED_METHODS })
  }

  instrument(dns) {
    const self = this
    function wrapCallback(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedMethod(...args) {
        const data = { name: `${self.packageName}.${method}` }
        return channel.traceCallback(original, -1, data, this, ...args)
      }
    }

    function wrapPromise(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedMethod(...args) {
        const data = { name: `${self.packageName}.${method}` }
        return channel.tracePromise(original, data, this, ...args)
      }
    }

    shimmer.wrapMethod(dns, 'dns', INSTRUMENTED_METHODS, wrapCallback)
    shimmer.wrapMethod(dns.Resolver.prototype, 'dns.Resolver', RESOLVER_PROTOTYPE_METHODS, wrapCallback)
    shimmer.wrapMethod(dns.promises, 'dns.promises', INSTRUMENTED_METHODS, wrapPromise)
    shimmer.wrapMethod(dns.promises.Resolver.prototype, 'dns.promises.Resolver', RESOLVER_PROTOTYPE_METHODS, wrapPromise)
  }
}

module.exports = DnsSubscriber
