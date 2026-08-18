/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('../base')
const bodyWrapped = Symbol('nrResponseWrap')
const RESPONSE_METHODS = ['text', 'json']

/**
 * Instruments the APIPromise constructor to prevent double response body
 * consumption
 *
 * The double-consumption scenario:
 * - NR's instrumentation triggers parse() on the original APIPromise, which
 *   chains responsePromise.then(parseResponse) → response.text().
 * - completions.parse() (or any _thenUnwrap caller) creates a second APIPromise
 *   that independently chains responsePromise.then(newParseFn) → response.text()
 *   again, causing "Body is unusable".
 *
 * On every APIPromise construction, attach a .then() to responsePromise
 * that caches response.text() and response.json() on the Response object itself.
 * openai >=7.5.0 uses response.text(); earlier 5.x versions use response.json().
 * Because this .then() is registered before any parse chain, it fires first and
 * the cache is in place before either parse path consumes the body.
 */
class OpenAIApiPromiseConstructorSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'openai', channelName: 'nr_apiPromise' })
    this.events = ['end']
    this.requireActiveTx = false
  }

  end(data) {
    const instance = data?.self
    if (!instance?.responsePromise) {
      return
    }

    instance.responsePromise.then(function wrappedPromise(props) {
      const { response } = props
      if (!response || response[bodyWrapped]) {
        return
      }
      response[bodyWrapped] = true
      for (const method of RESPONSE_METHODS) {
        if (typeof response[method] !== 'function') {
          continue
        }
        const orig = response[method]
        let cached = null
        response[method] = function wrappedResponseMethod() {
          if (!cached) {
            cached = orig.apply(this, arguments)
          }
          return cached
        }
      }
    // Ignore rejections on this observer branch. When responsePromise rejects
    // (e.g. network error, 4xx/5xx), the rejection already propagates to the
    // caller through the main APIPromise chain. Without this handler our
    // derived .then() would emit an unhandledRejection.
    }, () => {})
  }
}

module.exports = OpenAIApiPromiseConstructorSubscriber
