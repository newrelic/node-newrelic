/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')
const { transactionInfo } = require('#agentlib/symbols.js')
const makeMiddlewareRecorder = require('#agentlib/metrics/recorders/middleware.js')

// Request-scoped events (true) are instrumented; server lifecycle events (false) are not.
const ROUTE_EVENTS = {
  onRequest: true,
  onPreAuth: true,
  onCredentials: true,
  onPostAuth: true,
  onPreHandler: true,
  onPostHandler: true,
  onPreResponse: true,
  onPreStart: false,
  onPostStart: false,
  onPreStop: false,
  onPostStop: false
}

class HapiExtSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@hapi/hapi', channelName: 'nr_ext', system: 'Hapi' })
    this.wrapper.constructRecorder = function hapiExtConstructRecorder({ segmentName }) {
      return makeMiddlewareRecorder(segmentName)
    }
  }

  handler(data) {
    const { arguments: args } = data
    const [events, method] = args

    if (Array.isArray(events)) {
      for (let i = 0; i < events.length; i++) {
        events[i].method = this.#wrapMiddleware(events[i].method, events[i].type)
      }
    } else if (events && typeof events === 'object') {
      events.method = this.#wrapMiddleware(events.method, events.type)
    } else if (typeof events === 'string') {
      args[1] = this.#wrapMiddleware(method, events)
    }
  }

  #wrapMiddleware(middleware, event) {
    if (!ROUTE_EVENTS[event]) {
      return middleware
    }

    const mwName = middleware.name || '<anonymous>'
    const wrapped = this.wrapper.wrap({ handler: middleware, segmentName: this.wrapper.prefix + '/' + mwName + '//' + event })

    if (event !== 'onPreResponse') {
      return wrapped
    }

    // onPreResponse is an error handler — mark the error as handled on entry,
    // matching the old shim's ERRORWARE behavior (txInfo.errorHandled |= isErrorWare).
    function hapiOnPreResponseWrapper(request, h) {
      const txInfo = request?.raw?.req?.[transactionInfo] || {}
      txInfo.errorHandled = true
      return wrapped.apply(this, arguments)
    }
    Object.defineProperties(hapiOnPreResponseWrapper, {
      name: { value: middleware.name },
      length: { value: middleware.length }
    })
    return hapiOnPreResponseWrapper
  }
}

module.exports = HapiExtSubscriber
