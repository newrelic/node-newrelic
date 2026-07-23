/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const OpenAIApiPromiseSubscriber = require('./api-promise')

/**
 * Overrides the behavior of wrapping `_thenUnwrap` for openai < 5
 */
class OpenAILegacyApiPromiseSubscriber extends OpenAIApiPromiseSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_legacyThenUnwrap' })
  }

  /**
   * In openai <5 parse() captures parseResponse by reference at setup time.
   * Wrap `parsedPromise` and cache the first resolved parsedResponse to avoid
   * it getting called multiple times
   *
   * @param {object} data from tracing channel
   */
  cacheWrappedPromise(data) {
    const original = data.self
    const newPromise = data.result

    const cached = original.parsedPromise
    newPromise.parsedPromise = cached.then(async function wrappedParsedPromise(baseData) {
      const props = await original.responsePromise
      const savedParseResponse = original.parseResponse
      // assign to original parseResponse but it is an async function
      // however baseData was already resolved so this just injects it
      // into the call path of _thenUnwrap
      original.parseResponse = () => Promise.resolve(baseData)
      try {
        return await newPromise.parseResponse(props)
      } finally {
        original.parseResponse = savedParseResponse
      }
    })
  }
}

module.exports = OpenAILegacyApiPromiseSubscriber
