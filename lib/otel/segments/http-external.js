/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recordExternal = require('../../metrics/recorders/http_external')
const urltils = require('../../util/urltils')
const { transformTemplate } = require('../utils')
const { UNKNOWN } = require('../constants')

function assignHost(otelSpan, segmentTransformation) {
  let host = UNKNOWN
  if (typeof segmentTransformation?.host === 'string') {
    host = otelSpan?.attributes[segmentTransformation?.host]
  }

  if (segmentTransformation?.host?.template) {
    host = transformTemplate(segmentTransformation?.host.template, otelSpan.attributes)
  }

  return host
}

module.exports = function createHttpExternalSegment(agent, otelSpan, rule) {
  const context = agent.tracer.getContext()
  const segmentTransformation = rule.segmentTransformation

  const host = assignHost(otelSpan, segmentTransformation)
  const url = otelSpan?.attributes[segmentTransformation?.url]
  const system = otelSpan?.attributes[segmentTransformation?.system] ?? 'http'
  let parsedUrl
  let obfuscatedPath = `/${UNKNOWN}`
  if (url) {
    parsedUrl = new URL(url)
    obfuscatedPath = urltils.obfuscatePath(agent.config, parsedUrl.pathname)
  }

  const name = transformTemplate(segmentTransformation?.name?.template, { host, path: obfuscatedPath, ...otelSpan?.attributes })

  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    name,
    recorder: recordExternal(host, system),
    parent: context.segment,
    transaction: context.transaction
  })

  return { segment, transaction: context.transaction, rule }
}
