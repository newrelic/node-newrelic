/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Transaction = require('../../transaction')
const httpRecorder = require('../../metrics/recorders/http')
const urltils = require('../../util/urltils')
const url = require('node:url')
const { NODEJS, ACTION_DELIMITER } = require('../../metrics/names')

const DESTINATION = Transaction.DESTINATIONS.TRANS_COMMON
const {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_URL,
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  ATTR_RPC_SYSTEM,
} = require('../constants')

module.exports = function createServerSegment(agent, otelSpan) {
  const transaction = new Transaction(agent)
  transaction.type = 'web'
  transaction.nameState.setPrefix(NODEJS.PREFIX)
  transaction.nameState.setPrefix(ACTION_DELIMITER)
  const rpcSystem = otelSpan.attributes[ATTR_RPC_SYSTEM]
  const httpMethod = otelSpan.attributes[ATTR_HTTP_METHOD] ?? otelSpan.attributes[ATTR_HTTP_REQUEST_METHOD]
  let segment
  if (rpcSystem) {
    segment = rpcSegment({ agent, otelSpan, transaction, rpcSystem })
  } else {
    segment = httpSegment({ agent, otelSpan, transaction, httpMethod })
  }
  transaction.baseSegment = segment
  return { segment, transaction }
}

function rpcSegment({ agent, otelSpan, transaction, rpcSystem }) {
  const rpcService = otelSpan.attributes[ATTR_RPC_SERVICE] || 'Unknown'
  const rpcMethod = otelSpan.attributes[ATTR_RPC_METHOD] || 'Unknown'
  const name = `${rpcService}/${rpcMethod}`
  transaction.url = name
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', rpcMethod)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', transaction.url)
  transaction.nameState.setPrefix(rpcSystem)
  transaction.nameState.appendPath(transaction.url)
  const segment = agent.tracer.createSegment({
    name,
    recorder: httpRecorder,
    parent: transaction.trace.root,
    transaction
  })
  segment.addAttribute('component', rpcSystem)
  return segment
}

function httpSegment({ agent, otelSpan, transaction, httpMethod }) {
  const httpUrl = otelSpan.attributes[ATTR_HTTP_URL] || '/Unknown'
  transaction.nameState.setVerb(httpMethod)
  const requestUrl = url.parse(httpUrl, true)
  transaction.parsedUrl = requestUrl
  transaction.url = urltils.obfuscatePath(agent.config, requestUrl.pathname)
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', transaction.url)
  if (httpMethod) {
    transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', httpMethod)
  }
  transaction.applyUserNamingRules(requestUrl.pathname)
  // accept dt headers?
  // synthetics.assignHeadersToTransaction(agent.config, transaction, )
  return agent.tracer.createSegment({
    recorder: httpRecorder,
    name: requestUrl.pathname,
    parent: transaction.trace.root,
    transaction
  })
}
