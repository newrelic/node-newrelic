/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../../metrics/names')
const recordExternal = require('../../metrics/recorders/http_external')
const urltils = require('../../util/urltils')
const {
  UNKNOWN
} = require('../constants')
const { httpAttr } = require('../attr-mapping/http')

module.exports = function createHttpExternalSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const method = httpAttr({ key: 'method', span: otelSpan })
  const host = httpAttr({ key: 'clientHost', span: otelSpan }) ?? UNKNOWN

  const url = httpAttr({ key: 'clientUrl', span: otelSpan })
  let name = NAMES.EXTERNAL.PREFIX + host
  let parsedUrl
  let obfuscatedPath
  if (url) {
    parsedUrl = new URL(url)
    obfuscatedPath = urltils.obfuscatePath(agent.config, parsedUrl.pathname)
    name += obfuscatedPath
  }

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
  return { segment, transaction: context.transaction }
}
