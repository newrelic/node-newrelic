/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AiMonitoringChatSubscriber } = require('../ai-monitoring')
const { AI: { LANGCHAIN } } = require('../../metrics/names')
const {
  LangChainCompletionMessage,
  LangChainCompletionSummary
} = require('#agentlib/llm-events/langchain/index.js')
const { langchainRunId } = require('#agentlib/symbols.js')

class LangchainRunnableSubscriber extends AiMonitoringChatSubscriber {
  constructor ({ agent, logger, channelName = 'nr_invoke' }) {
    super({ agent, logger, packageName: '@langchain/core', channelName })
    this.name = `${LANGCHAIN.CHAIN}/invoke`
    this.trackingPrefix = LANGCHAIN.TRACKING_PREFIX
    this.events = ['asyncEnd']
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const { result: response, error: err } = data
    this.recordChatCompletionEvents({
      ctx,
      request,
      response,
      err,
      metadata: params?.metadata,
      tags: params?.tags
    })

    this.addLlmMeta({ ctx, version: data.moduleVersion })
  }

  createCompletionSummary({ ctx, response, err, metadata, tags }) {
    const { segment, transaction } = ctx
    // Stream calls that error on initial call lack a response message
    // so create an empty array in that case
    const messages = response ? [response] : []
    return new LangChainCompletionSummary({
      agent: this.agent,
      segment,
      transaction,
      error: !!err,
      messages,
      metadata,
      tags,
      runId: segment[langchainRunId]
    })
  }

  getMessages({ request, response }) {
    const messages = []
    // check if request is truthy and an empty string
    if (request || request === '') {
      messages.push(request)
    }

    // check if response is truthy and an empty string
    if (response || response === '') {
      messages.push(response)
    }

    return messages
  }

  createCompletionMessage({ ctx, response, index, completionId, message }) {
    const { segment, transaction } = ctx
    // check before grabbing a key from it in the AiMessageChunk case
    const isResponse = message === response
    if (message?.content) {
      message = message.content
    }

    let msgString
    try {
      msgString = typeof message === 'string' ? message : JSON.stringify(message)
    } catch (error) {
      this.logger.error(error, 'Failed to stringify message')
      msgString = ''
    }

    return new LangChainCompletionMessage({
      sequence: index,
      agent: this.agent,
      content: msgString,
      role: message?.role,
      completionId,
      segment,
      transaction,
      runId: segment[langchainRunId],
      isResponse
    })
  }
}

module.exports = LangchainRunnableSubscriber
