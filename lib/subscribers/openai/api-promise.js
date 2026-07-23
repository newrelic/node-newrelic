/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('../base')

/**
 * Instruments APIPromise._thenUnwrap to prevent double response body consumption.
 *
 * When NR's end handler for nr_responses calls wrapPromise(), it calls
 * apiPromise.then() which triggers APIPromise.parse(), setting parsedPromise
 * (a chain: responsePromise → defaultParseResponse → response.json()).
 *
 * responses.parse() then calls _thenUnwrap() on that same APIPromise to create
 * a second APIPromise whose parseResponse closure calls the original's parseResponse
 * field directly, bypassing the parsedPromise cache. Both chains subscribe to the
 * same responsePromise and both call response.json(), causing "Body is unusable".
 */
class OpenAIApiPromiseSubscriber extends Subscriber {
  constructor({ agent, logger, channelName = 'nr_thenUnwrap' }) {
    super({ agent, logger, packageName: 'openai', channelName })
    this.events = ['end']
    this.requireActiveTx = false
  }

  /**
   * Not all calls to _thenUnwrap have to be instrumented. This check verifies
   * if the properties exist that need wrapping on all openai versions
   * @param {object} data from tracing channel
   * @returns {boolean} if the _thenUnwrap should be instrumented
   */
  skipWrapping(data) {
    return data?.self?.parsedPromise === undefined || data.result === undefined
  }

  /**
   * parse() uses a closure that reads parseResponse via a live property lookup at call time, so caching it works.
   * @param {object} data from tracing channel
   */
  cacheWrappedPromise(data) {
    const original = data.self
    const originalParseResponse = original.parseResponse
    let cachedResult = null
    original.parseResponse = function wrappedParseResponse(client, props) {
      if (!cachedResult) {
        cachedResult = originalParseResponse(client, props)
      }
      return cachedResult
    }
  }

  end(data) {
    if (this.skipWrapping(data)) {
      return
    }

    this.cacheWrappedPromise(data)
  }
}

module.exports = OpenAIApiPromiseSubscriber
