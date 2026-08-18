/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('../base')

/**
 * Instruments OpenAI.responsePromise (introduced in openai@7.5.0) to prevent
 * double response body consumption.
 *
 * In openai@7.5.0, responsePromise() replaced direct APIPromise construction in
 * request(). It also overrides _thenUnwrap on each returned APIPromise instance
 * with an arrow function that closes over the 'parse' parameter — bypassing the
 * prototype method that the >=5.0.0 hook instruments.
 *
 * The double-consumption scenario:
 * 1. NR's asyncEnd on nr_responses calls .then() on the original APIPromise,
 *    triggering parse() → parsedPromise = responsePromise.then(parse) → response.json()
 * 2. responses.js calls ._thenUnwrap(transform) on the same promise, which calls
 *    this.responsePromise(request, newParseFn) where newParseFn closes over 'parse'.
 *    When newPromise resolves, newParseFn calls parse() → response.json() again → "Body is unusable".
 *
 * Fix: in the end handler, wrap _thenUnwrap on the returned APIPromise so that the
 * new promise's parsedPromise is pre-set to share the original's already-resolved parse
 * result, avoiding a second call to response.json().
 */
class OpenAIResponsePromiseSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'openai', channelName: 'nr_responsePromise' })
    this.events = ['end']
    this.requireActiveTx = false
  }

  end(data) {
    const original = data?.result
    if (!original?._thenUnwrap || !original?.parse) {
      return
    }

    const origThenUnwrap = original._thenUnwrap
    original._thenUnwrap = function wrappedThenUnwrap(transform) {
      const newPromise = origThenUnwrap.call(this, transform)
      // Pre-set parsedPromise on newPromise to reuse the original's parsed body.
      // parse() checks `if (!this.parsedPromise)` before setting it, so our pre-set
      // value is returned as-is — no second responsePromise.then(parse) chain is created,
      // and response.json() is only called once.
      newPromise.parsedPromise = Promise.all([original.parse(), original.responsePromise])
        .then(([baseData, props]) => transform(baseData, props))
      return newPromise
    }
  }
}

module.exports = OpenAIResponsePromiseSubscriber
