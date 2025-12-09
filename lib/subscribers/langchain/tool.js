/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LangchainSubscriber = require('./base')
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const { langchainRunId } = require('../../symbols')
const { LangChainTool } = require('../../llm-events/langchain')
const LlmErrorMessage = require('../../llm-events/error-message')
const { DESTINATIONS } = require('../../config/attribute-filter')

class LangchainToolSubscriber extends LangchainSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_call' })
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('Langchain instrumentation is disabled, not creating segment.')
      return ctx
    }
    const tool = data?.self

    const segment = this.agent.tracer.createSegment({
      name: `${LANGCHAIN.TOOL}/${tool?.name}`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }

  asyncEnd(data) {
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
    const { moduleVersion: pkgVersion, result, error: err } = data
    const { name, metadata: instanceMeta, description, tags: instanceTags } = data?.self
    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const { metadata: paramsMeta, tags: paramsTags } = params
    const metadata = this.mergeMetadata(instanceMeta, paramsMeta)
    const tags = this.mergeTags(instanceTags, paramsTags)

    segment.end()

    const toolEvent = new LangChainTool({
      agent,
      description,
      name,
      runId: segment[langchainRunId],
      metadata,
      transaction,
      tags,
      input: request?.input,
      output: result,
      segment,
      error: err != null
    })
    this.recordEvent({ type: 'LlmTool', pkgVersion, msg: toolEvent })

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

    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
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
