/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const BaseCoreSubscriber = require('./base')
const { wrapMethods } = require('../wrap-method')

const INSTRUMENTED_METHODS = ['pbkdf2', 'randomBytes', 'pseudoRandomBytes', 'randomFill', 'scrypt']

class CryptoSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'crypto', instrumentedMethods: INSTRUMENTED_METHODS })
  }

  /**
   * Wraps the callback-accepting crypto methods. `randomBytes` and its
   * deprecated alias `pseudoRandomBytes` run synchronously when the callback is
   * omitted; those calls are passed straight through rather than traced.
   *
   * @param {object} crypto the `crypto` core module
   */
  instrument(crypto) {
    const self = this
    wrapMethods({
      module: crypto,
      methodNames: INSTRUMENTED_METHODS,
      logger: this.logger,
      wrapper: function wrapMethod(original, method) {
        const channel = tracingChannel(`${self.id}:${method}`)

        return function wrappedMethod(...args) {
          if (typeof args.at(-1) !== 'function') {
            return original.apply(this, args)
          }

          const data = { name: `${self.packageName}.${method}` }
          return channel.traceCallback(original, -1, data, this, ...args)
        }
      }
    })
  }
}

module.exports = CryptoSubscriber
