/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const { INSTRUMENTED_METHODS, RESOLVE_METHODS } = require('#agentlib/subscribers/dns/constants.js')
const shimmer = require('#agentlib/shimmer.js')

module.exports = initialize

function initialize(_agent, dns) {
  shimmer.wrapMethod(dns, 'dns', INSTRUMENTED_METHODS, function wrapMethod(original, method) {
    const channel = tracingChannel(`nr:dns:${method}`)
    return function wrappedMethod(...args) {
      const callback = args.at(-1)
      const callbackName = callback?.name || '<anonymous>'
      const data = { name: `dns.${method}`, callbackName }
      return channel.traceCallback(original, -1, data, this, ...args)
    }
  })

  // All code below can be added separately. it adds the following:
  //  * instrumentation on resolve methods from `dns.Resolver.prototype`
  //  * instrumentation on `dns.promises.<method>`
  //  * instrumentation on resolve methods from `dns.promises.Resolver.prototype`
  shimmer.wrapMethod(dns.Resolver.prototype, 'dns', RESOLVE_METHODS, function wrapMethod(original, method) {
    const channel = tracingChannel(`nr:dns:${method}`)
    return function wrappedMethod(...args) {
      const callback = args.at(-1)
      const callbackName = callback?.name || '<anonymous>'
      const data = { name: `dns.${method}`, callbackName }
      return channel.traceCallback(original, -1, data, this, ...args)
    }
  })

  shimmer.wrapMethod(dns.promises, 'dns', INSTRUMENTED_METHODS, function wrapMethod(original, method) {
    const channel = tracingChannel(`nr:dns:promises:${method}`)
    return function wrappedMethod(...args) {
      const data = { name: `dns.${method}` }
      return channel.tracePromise(original, data, this, ...args)
    }
  })
  shimmer.wrapMethod(dns.promises.Resolver.prototype, 'dns', RESOLVE_METHODS, function wrapMethod(original, method) {
    const channel = tracingChannel(`nr:dns:promises:${method}`)
    return function wrappedMethod(...args) {
      const data = { name: `dns.${method}` }
      return channel.tracePromise(original, data, this, ...args)
    }
  })
}
