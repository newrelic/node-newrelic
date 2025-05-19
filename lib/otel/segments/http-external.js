/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recordExternal = require('../../metrics/recorders/http_external')
const urltils = require('../../util/urltils')
const transformationRules = require('../transformation-rules')
const { transformTemplate } = require('./utils')
const { UNKNOWN } = require('../constants')

module.exports = function createHttpExternalSegment(agent, otelSpan, rule) {
  const context = agent.tracer.getContext()
  const transformationRule = transformationRules.find((tRule) => tRule.name === rule)
  const { segment: segmentTransformation } = transformationRule

  const method = otelSpan?.attributes[segmentTransformation?.method]
  const host = otelSpan?.attributes[segmentTransformation?.host] ?? UNKNOWN
  const url = otelSpan?.attributes[segmentTransformation?.url]
  let parsedUrl
  let obfuscatedPath = `/${UNKNOWN}`
  if (url) {
    parsedUrl = new URL(url)
    obfuscatedPath = urltils.obfuscatePath(agent.config, parsedUrl.pathname)
  }

  const name = transformTemplate(segmentTransformation?.name?.template, { host, path: obfuscatedPath })

  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    name,
    recorder: recordExternal(host, 'http'),
    parent: context.segment,
    transaction: context.transaction
  })

  if (parsedUrl && segment) {
    segment.captureExternalAttributes({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      host: parsedUrl.host,
      method,
      port: parsedUrl.port,
      path: obfuscatedPath,
      queryParams: Object.fromEntries(parsedUrl.searchParams.entries())
    })
  }
  return { segment, transaction: context.transaction, rule }
}
