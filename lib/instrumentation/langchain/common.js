/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')

const common = module.exports

/**
 * Langchain allows you to define tags at the instance and call level
 * This helper merges the two into 1 array ensuring there are not duplicates
 *
 * @param {Array} localTags tags defined on instance of a langchain object
 * @param {Array} paramsTags tags defined on the method
 * @returns {Array} a merged array of unique tags
 */
common.mergeTags = function mergeTags(localTags = [], paramsTags = []) {
  const tags = localTags.filter((tag) => !paramsTags.includes(tag))
  tags.push(...paramsTags)
  return tags
}

/**
 * Langchain allows you to define metadata at the instance and call level
 * This helper merges the two into object favoring the call level metadata
 * values when duplicate keys exist.
 *
 * @param {object} localMeta metadata defined on instance of a langchain object
 * @param {object} paramsMeta metadata defined on the method
 * @returns {object} a merged object of metadata
 */
common.mergeMetadata = function mergeMetadata(localMeta = {}, paramsMeta = {}) {
  return { ...localMeta, ...paramsMeta }
}

/**
 * Helper to enqueue a LLM event into the custom event aggregator.  This will also
 * increment the Supportability metric that's used to derive a tag on the APM entity.
 *
 * @param {object} params function params
 * @param {Agent} params.agent NR agent
 * @param {string} params.type type of llm event(i.e.- LlmChatCompletionMessage, LlmTool, etc)
 * @param {object} params.msg the llm event getting enqueued
 * @param {string} params.pkgVersion version of langchain library instrumented
 */
common.recordEvent = function recordEvent({ agent, type, msg, pkgVersion }) {
  agent.metrics.getOrCreateMetric(`${LANGCHAIN.TRACKING_PREFIX}/${pkgVersion}`).incrementCallCount()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

/**
 * Helper to decide if instrumentation should be registered.
 *
 * @param {object} config agent config
 * @returns {boolean} flag if we should skip instrumentation
 */
common.shouldSkipInstrumentation = function shouldSkipInstrumentation(config) {
  return config.ai_monitoring.enabled !== true
}
