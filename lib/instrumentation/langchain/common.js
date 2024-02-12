/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')

const common = module.exports

common.getTags = function getTags(localTags = [], paramsTags = []) {
  const tags = localTags.filter((tag) => !paramsTags.includes(tag))
  tags.push(...paramsTags)
  return tags
}

common.getMetadata = function getMetadata(localMeta = {}, paramsMeta = {}) {
  return { ...localMeta, ...paramsMeta }
}

common.recordEvent = function recordEvent({ agent, type, msg, pkgVersion }) {
  agent.metrics.getOrCreateMetric(`${LANGCHAIN.TRACKING_PREFIX}/${pkgVersion}`).incrementCallCount()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

common.shouldSkipInstrumentation = function shouldSkipInstrumentation(config) {
  return !(
    config.ai_monitoring.enabled === true && config.feature_flag.langchain_instrumentation === true
  )
}
