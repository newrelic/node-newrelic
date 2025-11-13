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
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    if (!this?.agent?.config?.ai_monitoring?.enabled) {
      // We need this check inside the handler because it is possible for monitoring
      // to be disabled at the account level. In such a case, the value is set
      // after the instrumentation has been initialized.
      this.logger.debug('Langchain instrumentation is disabled. To enable, set `config.ai_monitoring.enabled` to true.')
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
    const { moduleVersion: pkgVersion, result, error: err } = data
    const { name, metadata: instanceMeta, description, tags: instanceTags } = data?.self
    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const { metadata: paramsMeta, tags: paramsTags } = params
    const metadata = this.mergeMetadata(instanceMeta, paramsMeta)
    const tags = this.mergeTags(instanceTags, paramsTags)

    const { agent } = this
    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }
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
}

module.exports = LangchainToolSubscriber
