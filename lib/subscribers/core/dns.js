/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const BaseCoreSubscriber = require('./base')
const { wrapMethods } = require('../wrap-method')

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
  'resolveTlsa',
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
    const id = this.id
    const packageName = this.packageName

    function wrapCallback(original, method) {
      const channel = tracingChannel(`${id}:${method}`)
      return function wrappedMethod(...args) {
        const data = { name: `${packageName}.${method}` }
        return channel.traceCallback(original, -1, data, this, ...args)
      }
    }

    function wrapPromise(original, method) {
      const channel = tracingChannel(`${id}:${method}`)
      return function wrappedMethod(...args) {
        const data = { name: `${packageName}.${method}` }
        return channel.tracePromise(original, data, this, ...args)
      }
    }

    wrapMethods({
      module: dns,
      methodNames: INSTRUMENTED_METHODS,
      logger: this.logger,
      wrapper: wrapCallback
    })
    wrapMethods({
      module: dns.Resolver.prototype,
      methodNames: RESOLVER_PROTOTYPE_METHODS,
      logger: this.logger,
      wrapper: wrapCallback
    })
    wrapMethods({
      module: dns.promises,
      methodNames: INSTRUMENTED_METHODS,
      logger: this.logger,
      wrapper: wrapPromise
    })
    wrapMethods({
      module: dns.promises.Resolver.prototype,
      methodNames: RESOLVER_PROTOTYPE_METHODS,
      logger: this.logger,
      wrapper: wrapPromise
    })
  }
}

module.exports = DnsSubscriber
