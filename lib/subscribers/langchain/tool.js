/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { AiMonitoringSubscriber } = require('../ai-monitoring')
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const { langchainRunId } = require('../../symbols')
const { LlmTool } = require('../../llm-events/langchain')
const LlmErrorMessage = require('../../llm-events/error-message')

class LangchainToolSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@langchain/core', channelName: 'nr_call', trackingPrefix: LANGCHAIN.TRACKING_PREFIX, name: 'unknown' })
    this.events = ['asyncEnd']
    this.trackingPrefix = LANGCHAIN.TRACKING_PREFIX
  }

  handler(data, ctx) {
    const tool = data?.self
    this.name = `${LANGCHAIN.TOOL}/${tool?.name}`
    return super.handler(data, ctx)
  }

  asyncEnd(data) {
    // Extract data and exit early if need be.
    const { agent, logger } = this
    if (!this.enabled) {
      logger.debug('Langchain instrumentation is disabled, not recording Llm events.')
      return
    }
    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }
    const { result, error: err } = data
    const { name, metadata: instanceMeta, description, tags: instanceTags } = data?.self

    // Get metadata and tags
    const params = data?.arguments?.[1] || {}
    const { metadata: paramsMeta, tags: paramsTags } = params
    const metadata = this.mergeMetadata(instanceMeta, paramsMeta)
    const tags = this.mergeTags(instanceTags, paramsTags)

    // Get tool output and input
    const request = data?.arguments?.[0]
    const output = result?.content ?? result
    let input
    if (request?.input) {
      input = request.input.toString()
    } else if (request) {
      input = JSON.stringify(request)
    }

    segment.addSpanAttribute('subcomponent', `{"type":"APM-AI_TOOL","name":"${name}"}`)
    segment.end()

    const toolEvent = new LlmTool({
      agent,
      description,
      toolName: name,
      aiAgentName: params.configurable?.__pregel_scratchpad?.currentTaskInput?.messages?.[1]?.name,
      runId: segment[langchainRunId] ?? params.toolCall?.id,
      metadata,
      transaction,
      tags,
      input,
      output,
      segment,
      error: err != null
    })
    this.recordEvent({ type: 'LlmTool', msg: toolEvent })

    if (err) {
      agent.errors.add(
        transaction,
        err,
        new LlmErrorMessage({
          response: {},
          cause: err,
          tool: toolEvent
        })
      )
    }
  }

  /**
   * Langchain allows you to define tags at the instance and call level
   * This helper merges the two into 1 array ensuring there are not duplicates
   *
   * @param {Array} localTags tags defined on instance of a langchain object
   * @param {Array} paramsTags tags defined on the method
   * @returns {Array} a merged array of unique tags
   */
  mergeTags(localTags = [], paramsTags = []) {
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
  mergeMetadata(localMeta = {}, paramsMeta = {}) {
    return { ...localMeta, ...paramsMeta }
  }
}

module.exports = LangchainToolSubscriber
