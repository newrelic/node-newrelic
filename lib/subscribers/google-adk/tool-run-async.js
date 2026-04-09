/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AiMonitoringSubscriber = require('../ai-monitoring/base')
const LlmTool = require('#agentlib/llm-events/tool.js')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')
const { AI: { GOOGLE_ADK } } = require('#agentlib/metrics/names.js')

module.exports = class GoogleAdkToolRunSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      packageName: '@google/adk',
      channelName: 'nr_toolRunAsync',
      name: `${GOOGLE_ADK.TOOL}/runAsync/unknown`,
      trackingPrefix: GOOGLE_ADK.TRACKING_PREFIX
    })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    const toolName = data?.self?.name ?? 'unknown'
    this.toolName = toolName
    this.toolDescription = data?.self?.description
    this.toolInput = data?.arguments?.[0]?.args
      ? JSON.stringify(data.arguments[0].args)
      : undefined
    this.name = `${GOOGLE_ADK.TOOL}/runAsync/${toolName}`
    return super.handler(data, ctx)
  }

  asyncEnd(data) {
    const { agent, logger, toolName, toolDescription, toolInput } = this
    if (!this.enabled) {
      logger.debug('Google ADK instrumentation is disabled, not instrumenting FunctionTool.runAsync.')
      return
    }

    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (!(segment || transaction) || (transaction?.isActive() !== true)) {
      return
    }

    const { error: err, result } = data

    segment.addSpanAttribute('subcomponent', `{"type": "APM-AI_TOOL", "name": "${toolName}"}`)
    segment.end()

    const output = result != null ? JSON.stringify(result) : undefined

    const toolEvent = new LlmTool({
      agent,
      segment,
      transaction,
      toolName,
      description: toolDescription,
      vendor: 'google_adk',
      aiAgentName: undefined,
      runId: undefined,
      input: toolInput,
      output,
      error: err !== null
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
}
