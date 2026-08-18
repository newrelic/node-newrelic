/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('../base')

const bodyWrapped = Symbol('nrResponseWrap')
const RESPONSE_METHODS = ['text', 'json']

/**
 * Instruments defaultParseResponse to prevent double response body consumption.
 *
 * The double-consumption scenario:
 * - NR's instrumentation triggers parse() on the original APIPromise, which
 *   chains responsePromise.then(parseResponse) → response.text() / response.json().
 * - completions.parse() (or any _thenUnwrap caller) creates a second APIPromise
 *   that independently chains responsePromise.then(newParseFn) → response.text()
 *   again, causing "Body is unusable".
 *
 * The start handler fires synchronously before the function body runs, so
 * response.text() and response.json() are wrapped with a one-shot cache before
 * either parse path consumes the body. openai 4.x uses either response.json or
 * response.text depending on the content types, so both have to be wrapped
 *
 * Argument position differs between versions:
 *   4.x:  defaultParseResponse(props)
 *   5.x+: defaultParseResponse(client, props)
 */
class OpenAIParseResponseSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'openai', channelName: 'nr_parseResponse' })
    this.requireActiveTx = false
  }

  handler(data, ctx) {
    const cached = {}
    const props = data.arguments.at(-1)
    const { response } = props ?? {}
    if (!response || response[bodyWrapped]) {
      return
    }

    response[bodyWrapped] = true

    for (const method of RESPONSE_METHODS) {
      if (typeof response[method] !== 'function') {
        continue
      }
      const orig = response[method]
      response[method] = function wrappedResponseMethod() {
        if (!cached[method]) {
          cached[method] = orig.apply(this, arguments)
        }
        return cached[method]
      }
    }

    return ctx
  }
}

module.exports = OpenAIParseResponseSubscriber
