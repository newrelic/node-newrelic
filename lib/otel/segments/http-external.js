/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../../metrics/names')
const recordExternal = require('../../metrics/recorders/http_external')

const {
  ATTR_NET_PEER_NAME,
  ATTR_SERVER_ADDRESS
} = require('../constants')

module.exports = function createHttpExternalSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const host = otelSpan.attributes[ATTR_SERVER_ADDRESS] || otelSpan.attributes[ATTR_NET_PEER_NAME] || 'Unknown'
  const name = NAMES.EXTERNAL.PREFIX + host
  const segment = agent.tracer.createSegment({
    name,
    recorder: recordExternal(host, 'http'),
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}
