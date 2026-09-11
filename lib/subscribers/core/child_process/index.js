/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('../base')
const shimmer = require('../../../shimmer')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const INSTRUMENTED_METHODS = ['exec', 'execFile']

class ChildProcessSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'child_process', hasCallback: true, instrumentedMethods: INSTRUMENTED_METHODS })
  }

  /**
   * Wraps `exec`/`execFile`. Both accept an optional callback (e.g.
   * `cp.exec('ls')`), so we only trace as a callback when the last argument
   * actually is one -- otherwise `traceCallback` would clobber a real
   * argument (the command, or an options object) with a synthetic callback.
   *
   * @param {object} childProcess the `child_process` core module
   */
  instrument(childProcess) {
    const self = this
    shimmer.wrapMethod(childProcess, 'child_process', INSTRUMENTED_METHODS, function wrapMethod(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)

      function wrappedMethod(...args) {
        const lastArg = args.at(-1)
        const hasCallback = typeof lastArg === 'function'
        const data = { name: `${self.packageName}.${method}`, callbackName: hasCallback ? (lastArg.name || '<anonymous>') : null }

        return hasCallback
          ? channel.traceCallback(original, -1, data, this, ...args)
          : channel.traceSync(original, data, this, ...args)
      }

      // `shimmer.wrapMethod` only copies string-keyed enumerable properties
      // (e.g. via `Object.entries`), so Symbol-keyed ones like
      // `util.promisify.custom` need to be preserved here ourselves.
      for (const symbol of Object.getOwnPropertySymbols(original)) {
        wrappedMethod[symbol] = original[symbol]
      }

      return wrappedMethod
    })
  }
}

module.exports = ChildProcessSubscriber
