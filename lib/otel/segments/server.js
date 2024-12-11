/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_URL,
  SEMATTRS_RPC_SYSTEM,
  SEMATTRS_RPC_SERVICE,
  SEMATTRS_RPC_METHOD
} = require('@opentelemetry/semantic-conventions')
const { DESTINATIONS } = require('../../config/attribute-filter')
const DESTINATION = DESTINATIONS.TRANS_COMMON
const Transaction = require('../../transaction')
const urltils = require('../../util/urltils')
const url = require('url')

module.exports = class ServerSegment {
  constructor(agent, otelSpan) {
    this.agent = agent
    this.transaction = new Transaction(agent)
    this.transaction.type = 'web'
    this.otelSpan = otelSpan
    const rpcSystem = otelSpan.attributes[SEMATTRS_RPC_SYSTEM]
    const httpMethod = otelSpan.attributes[SEMATTRS_HTTP_METHOD]
    if (rpcSystem) {
      this.segment = this.rpcSegment(rpcSystem)
    } else if (httpMethod) {
      this.segment = this.httpSegment(httpMethod)
    } else {
      this.segment = this.genericHttpSegment()
    }
    this.transaction.baseSegment = this.segment
    return { segment: this.segment, transaction: this.transaction }
  }

  rpcSegment(rpcSystem) {
    const rpcService = this.otelSpan.attributes[SEMATTRS_RPC_SERVICE] || 'Unknown'
    const rpcMethod = this.otelSpan.attributes[SEMATTRS_RPC_METHOD] || 'Unknown'
    const name = `WebTransaction/WebFrameworkUri/${rpcSystem}/${rpcService}.${rpcMethod}`
    this.transaction.name = name
    this.transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', rpcMethod)
    this.transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', name)
    this.transaction.url = name
    const segment = this.agent.tracer.createSegment({
      name,
      parent: this.transaction.trace.root,
      transaction: this.transaction
    })
    segment.addAttribute('component', rpcSystem)
    return segment
  }

  // most instrumentation will hit this case
  // I find that if the request is in a web framework, the web framework instrumentation
  // sets `http.route` and when the span closes it pulls that attribute in
  // we'll most likely need to wire up some naming reconciliation
  // to handle this use case.
  httpSegment(httpMethod) {
    const httpRoute = this.otelSpan.attributes[SEMATTRS_HTTP_ROUTE] || 'Unknown'
    const httpUrl = this.otelSpan.attributes[SEMATTRS_HTTP_URL] || '/Unknown'
    const requestUrl = url.parse(httpUrl, true)
    const name = `WebTransaction/Nodejs/${httpMethod}/${httpRoute}`
    this.transaction.name = name
    this.transaction.url = urltils.obfuscatePath(this.agent.config, requestUrl.pathname)
    this.transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', this.transaction.url)
    this.transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', httpMethod)
    return this.agent.tracer.createSegment({
      name,
      parent: this.transaction.trace.root,
      transaction: this.transaction
    })
  }

  genericHttpSegment() {
    const name = 'WebTransaction/NormalizedUri/*'
    this.transaction.name = name
    return this.agent.tracer.createSegment({
      name,
      parent: this.transaction.trace.root,
      transaction: this.transaction
    })
  }
}
