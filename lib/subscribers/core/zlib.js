/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const shimmer = require('#agentlib/shimmer.js')
const BaseCoreSubscriber = require('#agentlib/subscribers/core/base.js')

const instrumentedMethods = [
  'deflate',
  'deflateRaw',
  'gunzip',
  'gzip',
  'inflate',
  'inflateRaw',
  'unzip'
]

class ZlibSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      packageName: 'zlib',
      hasCallback: true,
      instrumentedMethods
    })
  }

  instrument(zlib) {
    const id = this.id
    const packageName = this.packageName
    shimmer.wrapMethod(
      zlib,
      this.packageName,
      instrumentedMethods,
      function zlibMethodWrapper(original, method) {
        const channel = tracingChannel(`${id}:${method}`)
        return function zlibWrappedMethod(...args) {
          const data = { name: `${packageName}.${method}` }
          return channel.traceCallback(original, -1, data, this, ...args)
        }
      }
    )
  }
}

module.exports = ZlibSubscriber
