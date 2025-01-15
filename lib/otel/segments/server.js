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

module.exports = function createServerSegment(agent, otelSpan) {
  const transaction = new Transaction(agent)
  transaction.type = 'web'
  const rpcSystem = otelSpan.attributes[SEMATTRS_RPC_SYSTEM]
  const httpMethod = otelSpan.attributes[SEMATTRS_HTTP_METHOD]
  let segment
  if (rpcSystem) {
    segment = rpcSegment({ agent, otelSpan, transaction, rpcSystem })
  } else if (httpMethod) {
    segment = httpSegment({ agent, otelSpan, transaction, httpMethod })
  } else {
    segment = genericHttpSegment({ agent, transaction })
  }
  transaction.baseSegment = segment
  return { segment, transaction }
}

function rpcSegment({ agent, otelSpan, transaction, rpcSystem }) {
  const rpcService = otelSpan.attributes[SEMATTRS_RPC_SERVICE] || 'Unknown'
  const rpcMethod = otelSpan.attributes[SEMATTRS_RPC_METHOD] || 'Unknown'
  const name = `WebTransaction/WebFrameworkUri/${rpcSystem}/${rpcService}.${rpcMethod}`
  transaction.name = name
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', rpcMethod)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', name)
  transaction.url = name
  const segment = agent.tracer.createSegment({
    name,
    parent: transaction.trace.root,
    transaction
  })
  segment.addAttribute('component', rpcSystem)
  return segment
}

// most instrumentation will hit this case
// I find that if the request is in a web framework, the web framework instrumentation
// sets `http.route` and when the span closes it pulls that attribute in
// we'll most likely need to wire up some naming reconciliation
// to handle this use case.
function httpSegment({ agent, otelSpan, transaction, httpMethod }) {
  const httpRoute = otelSpan.attributes[SEMATTRS_HTTP_ROUTE] || 'Unknown'
  const httpUrl = otelSpan.attributes[SEMATTRS_HTTP_URL] || '/Unknown'
  const requestUrl = url.parse(httpUrl, true)
  const name = `WebTransaction/Nodejs/${httpMethod}/${httpRoute}`
  transaction.name = name
  transaction.url = urltils.obfuscatePath(agent.config, requestUrl.pathname)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', transaction.url)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', httpMethod)
  return agent.tracer.createSegment({
    name,
    parent: transaction.trace.root,
    transaction
  })
}

function genericHttpSegment({ agent, transaction }) {
  const name = 'WebTransaction/NormalizedUri/*'
  transaction.name = name
  return agent.tracer.createSegment({
    name,
    parent: transaction.trace.root,
    transaction
  })
}
