/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const zlib = require('node:zlib')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const {
  TracingChannelSubscription,
  TracingChannelSubscriber
} = require('#agentlib/subscribers/tracing-channel-subscriber.js')
const { wrapMethod } = require('#agentlib/subscribers/wrap-method.js')

const methods = [
  'deflate',
  'deflateRaw',
  'gzip',
  'gunzip',
  'inflate',
  'inflateRaw',
  'unzip'
]
const subscriptions = []
for (const method of methods) {
  // First we need to monkey-patch the module methods to generating
  // tracing channel events.
  const chanName = `nr_core:zlib:${method}`
  wrapMethod({
    module: zlib,
    methodName: method,
    wrapper(originalMethod, methodName) {
      const chan = tracingChannel(chanName)
      const data = { segmentName: `zlib.${methodName}` }
      return function wrappedMethod(...args) {
        chan.traceCallback(originalMethod, -1, data, this, ...args)
      }
    }
  })

  // Now we can create a subscription for the channel we created.
  const sub = new TracingChannelSubscription({ channel: chanName })
  subscriptions.push(sub)
}

class ZlibSubscriber extends TracingChannelSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'zlib', subs: subscriptions })
  }
}

module.exports = ZlibSubscriber
