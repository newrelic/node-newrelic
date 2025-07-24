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
// TODO: Add back when orchestrion supports package version
// const MIN_STREAM_VERSION = '4.12.2'

class OpenAIChatCompletions extends OpenAISubscriber {
  constructor({ agent, logger, channelName = 'nr_completionsCreate' }) {
    super({ agent, logger, channelName })
  }

  handler(data, ctx) {
    // TODO: check if streaming is supported by checking for `request.stream` and pkg version
    // const { arguments: args } = data
    // const [ request ] = args
    const segment = this.agent.tracer.createSegment({
      name: OPENAI.COMPLETION,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }

  asyncEnd(data) {
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

    // TODO: need to PR orchtestrion to return the actual version of the OpenAI package
    addLlmMeta({
      agent: this.agent,
      transaction: ctx.transaction,
      version: '4.104.0'
    })
  }
}

module.exports = OpenAIChatCompletions
