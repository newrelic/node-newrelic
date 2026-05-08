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
    const { arguments: args, self } = data
    const toolName = self.name ?? 'unknown'
    this.toolName = toolName
    this.name = `${GOOGLE_ADK.TOOL}/runAsync/${toolName}`
    try {
      this.toolInput = JSON.stringify(args[0]?.args)
    } catch (err) {
      this.logger.warn(err, 'Failed to stringify tool input')
    }
    return super.handler(data, ctx)
  }

  asyncEnd(data) {
    const { agent, logger, toolName, toolInput } = this
    if (!this.enabled) {
      logger.debug('Google ADK instrumentation is disabled, not instrumenting FunctionTool.runAsync.')
      return
    }

    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (!(segment || transaction) || (transaction?.isActive() !== true)) {
      return
    }
    segment.addSpanAttribute('subcomponent', `{"type": "APM-AI_TOOL", "name": "${toolName}"}`)
    segment.end()

    const { error: err, result } = data
    let output
    try {
      output = JSON.stringify(result)
    } catch (err) {
      logger.warn(err, 'Failed to stringify tool output')
    }

    const toolEvent = new LlmTool({
      agent,
      segment,
      transaction,
      toolName,
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
