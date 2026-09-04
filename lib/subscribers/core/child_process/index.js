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

// `exec`'s raw implementation calls `execFile` internally, forwarding its
// own already-instrumented callback. Marking `exec` opaque means: while its
// synchronous body is running (including whatever it calls internally),
// nested instrumented methods skip their own callback tracking -- exec's own
// tracking already covers that same completion. Only `exec` needs this;
// `execFile` doesn't call any other instrumented method.
const OPAQUE_METHODS = new Set(['exec'])

class ChildProcessSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'child_process', hasCallback: true, instrumentedMethods: INSTRUMENTED_METHODS })
    this._opaque = false
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
      const isOpaque = OPAQUE_METHODS.has(method)

      function wrappedMethod(...args) {
        const lastArg = args.at(-1)
        // While nested inside an opaque call (self._opaque), skip callback
        // tracking even if a real callback was passed -- see OPAQUE_METHODS.
        const hasCallback = typeof lastArg === 'function' && !self._opaque
        const data = { name: `${self.packageName}.${method}`, callbackName: hasCallback ? (lastArg.name || '<anonymous>') : null }

        if (!isOpaque) {
          return hasCallback
            ? channel.traceCallback(original, -1, data, this, ...args)
            : channel.traceSync(original, data, this, ...args)
        }

        self._opaque = true
        try {
          return hasCallback
            ? channel.traceCallback(original, -1, data, this, ...args)
            : channel.traceSync(original, data, this, ...args)
        } finally {
          self._opaque = false
        }
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
