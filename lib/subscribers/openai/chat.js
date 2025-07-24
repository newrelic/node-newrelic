'use strict'
/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('../base')
const logger = require('../../logger').child({ component: 'openai-subscriber' })
const { AI } = require('../../metrics/names')
const { OPENAI } = AI
const {
  addLlmMeta,
  recordChatCompletionMessages,
  instrumentStream,
} = require('./utils')
// TODO: Add back when orchestriong supports package version
//const MIN_STREAM_VERSION = '4.12.2'

class OpenAIChatCompletions extends Subscriber {
  constructor(agent, id = 'openai:nr_completionsCreate') {
    super(agent, id)
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  get enabled() {
    return this.config.ai_monitoring.enabled === true
  }

  handler(data, ctx) {
    // TODO: check if streaming is supported by checking for `request.stream` and pkg version
    //const { arguments: args } = data
    //const [ request ] = args
    const segment = this._agent.tracer.createSegment({
      name: OPENAI.COMPLETION,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }

  asyncEnd(data) {
    const ctx = this._agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    const { result: response, arguments: args, error: err } = data
    const [ request ] = args

    if (request.stream) {
      instrumentStream({
        agent: this._agent,
        logger,
        request,
        headers: ctx.extras?.headers,
        response,
        segment: ctx.segment,
        transaction: ctx.transaction,
        err
      })
    } else {
      recordChatCompletionMessages({
        agent: this._agent,
        logger,
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
      agent: this._agent,
      transaction: ctx.transaction,
      version: '4.104.0'
    })
  }
}

class OpenAIResponses extends OpenAIChatCompletions {
  constructor(agent) {
    super(agent, 'openai:nr_responses')
  }
}

const chatConfig = [ 
  {
    channelName: 'nr_completionsCreate',
    module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'resources/chat/completions.js' },
    functionQuery: {
      className: 'Completions',
      methodName: 'create',
      kind: 'Async'
    }
  },
  {
    channelName: 'nr_completionsCreate',
    module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'resources/chat/completions/completions.js' },
    functionQuery: {
      className: 'Completions',
      methodName: 'create',
      kind: 'Async'
    }
  },
  {
    channelName: 'nr_responses',
    module: { name: 'openai', versionRange: '>=4.87.0', filePath: 'resources/responses/responses.js' },
    functionQuery: {
      className: 'Responses',
      methodName: 'create',
      kind: 'Async'
    }
  }
]

module.exports = {
  OpenAIChatCompletions,
  OpenAIResponses,
  chatConfig
}
