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
const { propagateTraceContext } = require('./utils')
const { httpAttr } = require('../attr-mapping/http')
const DESTINATION = Transaction.DESTINATIONS.TRANS_COMMON
const { UNKNOWN } = require('../constants')

module.exports = function createServerSegment(agent, otelSpan) {
  const spanContext = otelSpan.spanContext()
  const transaction = new Transaction(agent, spanContext?.traceId)
  transaction.type = 'web'
  transaction.nameState.setPrefix(NODEJS.PREFIX)
  transaction.nameState.setPrefix(ACTION_DELIMITER)
  propagateTraceContext({ transaction, otelSpan, transport: 'HTTPS' })
  const system = httpAttr({ key: 'rpcSystem', span: otelSpan })
  let segment
  if (system) {
    segment = rpcSegment({ agent, otelSpan, transaction, system })
  } else {
    segment = httpSegment({ agent, otelSpan, transaction })
  }
  transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', transaction.url)
  transaction.baseSegment = segment
  return { segment, transaction }
}

function rpcSegment({ agent, otelSpan, transaction, system }) {
  const service = httpAttr({ key: 'rpcService', span: otelSpan }) ?? UNKNOWN
  const method = httpAttr({ key: 'rpcMethod', span: otelSpan }) ?? UNKNOWN
  const name = `${service}/${method}`
  transaction.url = name
  transaction.nameState.setPrefix(system)
  transaction.nameState.appendPath(transaction.url)
  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    name,
    recorder: httpRecorder,
    parent: transaction.trace.root,
    transaction
  })
  return segment
}

function httpSegment({ agent, otelSpan, transaction }) {
  const httpMethod = httpAttr({ key: 'method', span: otelSpan })
  const httpUrl = httpAttr({ key: 'url', span: otelSpan })
  transaction.nameState.setVerb(httpMethod)
  const requestUrl = url.parse(httpUrl, true)
  transaction.parsedUrl = requestUrl
  transaction.url = urltils.obfuscatePath(agent.config, requestUrl.pathname)
  transaction.applyUserNamingRules(requestUrl.pathname)
  return agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    recorder: httpRecorder,
    name: requestUrl.pathname,
    parent: transaction.trace.root,
    transaction
  })
}
