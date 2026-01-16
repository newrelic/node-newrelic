/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const OpenAISubscriber = require('./base')
const { AI } = require('../../metrics/names')
const { OPENAI } = AI
const {
  addLlmMeta,
  recordChatCompletionMessages,
  instrumentStream,
} = require('./utils')
const semver = require('semver')
const MIN_STREAM_VERSION = '4.12.2'

class OpenAIChatCompletions extends OpenAISubscriber {
  constructor({ agent, logger, channelName = 'nr_completionsCreate' }) {
    super({ agent, logger, channelName })
  }

  handler(data, ctx) {
    const { arguments: args, moduleVersion } = data
    const [request] = args
    if (request.stream && semver.lt(moduleVersion, MIN_STREAM_VERSION)) {
      this.logger.warn(`Instrumenting chat completion streams is only supported with openai version ${MIN_STREAM_VERSION}+.`)
      return ctx
    }
    if (!this.enabled) {
      this.logger.debug('OpenAI instrumentation is disabled, not creating segment.')
      return
    }

    return this.createSegment({
      name: OPENAI.COMPLETION,
      ctx
    })
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('OpenAI instrumentation is disabled, not recording Llm events.')
      return
    }
    const ctx = this.agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    const { result: response, arguments: args, error: err } = data
    const [request] = args

    if (request.stream) {
      instrumentStream({
        agent: this.agent,
        logger: this.logger,
        request,
        headers: ctx.extras?.headers,
        response,
        segment: ctx.segment,
        transaction: ctx.transaction,
        err
      })
    } else {
      recordChatCompletionMessages({
        agent: this.agent,
        logger: this.logger,
        segment: ctx.segment,
        transaction: ctx.transaction,
        request,
        response,
        headers: ctx.extras?.headers,
        err
      })
    }

    addLlmMeta({
      agent: this.agent,
      transaction: ctx.transaction,
      version: data.moduleVersion,
    })
  }
}

module.exports = OpenAIChatCompletions
