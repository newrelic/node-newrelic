/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const AzureHandler = require('#agentlib/subscribers/azure-functions/azure-handler-base.js')
const Transaction = require('#agentlib/transaction/index.js')
const { TYPES } = Transaction
const { Transform } = require('node:stream')
const recordWeb = require('#agentlib/metrics/recorders/http.js')

module.exports = class HttpHandler extends AzureHandler {
  constructor({ subscriber }) {
    super(subscriber)
    this.type = TYPES.WEB
  }

  #initializeWeb(transaction, request) {
    const absoluteUrl = request.url
    const url = new URL(absoluteUrl)
    const transport = url.protocol === 'https:' ? 'HTTPS' : 'HTTP'
    const port = url.port || (transport === 'HTTPS' ? 443 : 80)
    transaction.initializeWeb({ absoluteUrl, method: request.method, port, headers: request.headers, transport })
  }

  runHandlerInContext({ originalHandler, ctx, thisArg, handlerArgs }) {
    const { transaction } = ctx
    const [request] = handlerArgs
    const self = this
    function inContext() {
      self.#initializeWeb(transaction, request)
      return originalHandler.apply(this, arguments)
    }

    return this.agent.tracer.bindFunction(inContext, ctx).apply(thisArg, handlerArgs)
  }

  finalizeTransaction({ result, transaction }) {
    transaction.finalizeWeb({ statusCode: result?.status, headers: result?.headers, end: false })
    if (result?.body instanceof Transform) {
      result.body.on('close', () => transaction.end())
    } else {
      transaction.end()
    }
    return result
  }

  createSegment({ handlerArgs, ctx }) {
    const [request] = handlerArgs
    return this.subscriber.createSegment({
      name: request.url,
      recorder: recordWeb,
      ctx
    })
  }
}
