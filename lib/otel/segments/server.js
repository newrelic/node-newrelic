/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Transaction = require('../../transaction')
const httpRecorder = require('../../metrics/recorders/http')
const urltils = require('../../util/urltils')
const url = require('node:url')

const DESTINATION = Transaction.DESTINATIONS.TRANS_COMMON
const {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_URL,
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  ATTR_RPC_SYSTEM,
} = require('../constants')

module.exports = function createServerSegment(agent, otelSpan) {
  const transaction = new Transaction(agent)
  transaction.type = 'web'
  const rpcSystem = otelSpan.attributes[ATTR_RPC_SYSTEM]
  const httpMethod = otelSpan.attributes[ATTR_HTTP_METHOD] ?? otelSpan.attributes[ATTR_HTTP_REQUEST_METHOD]
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
  const rpcService = otelSpan.attributes[ATTR_RPC_SERVICE] || 'Unknown'
  const rpcMethod = otelSpan.attributes[ATTR_RPC_METHOD] || 'Unknown'
  const name = `WebTransaction/WebFrameworkUri/${rpcSystem}/${rpcService}.${rpcMethod}`
  transaction.name = name
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', rpcMethod)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', name)
  transaction.url = name
  const segment = agent.tracer.createSegment({
    name,
    recorder: httpRecorder,
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
  const httpRoute = otelSpan.attributes[ATTR_HTTP_ROUTE] || 'Unknown'
  const httpUrl = otelSpan.attributes[ATTR_HTTP_URL] || '/Unknown'
  const requestUrl = url.parse(httpUrl, true)
  const name = `WebTransaction/Nodejs/${httpMethod}/${httpRoute}`
  transaction.name = name
  transaction.url = urltils.obfuscatePath(agent.config, requestUrl.pathname)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', transaction.url)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', httpMethod)
  return agent.tracer.createSegment({
    name,
    recorder: httpRecorder,
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
