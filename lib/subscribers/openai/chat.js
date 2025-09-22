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
    this.events = ['asyncEnd', 'end']
  }

  handler(data, ctx) {
    const { arguments: args, moduleVersion } = data
    const [request] = args
    if (request.stream && semver.lt(moduleVersion, MIN_STREAM_VERSION)) {
      this.logger.warn(`Instrumenting chat completion streams is only supported with openai version ${MIN_STREAM_VERSION}+.`)
      return ctx
    }

    const segment = this.agent.tracer.createSegment({
      name: OPENAI.COMPLETION,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }

  /**
   * Temporary fix as `tracePromise` wraps the promise in a native one.
   * We are now wrapping `openai.chat.completions.parse` in a traceSync call
   * and then wrapping the promise here so it returns the custom promise.
   * OpenAI has a [custom promise](https://github.com/openai/openai-node/blob/master/src/core/api-promise.ts) that crashes applications using `openai.chat.completions.parse`
   * see: https://github.com/newrelic/node-newrelic/issues/3379
   * see: https://github.com/nodejs/node/issues/59936
   * @param {Object} data data associated with the Subscriber end event
   */
  end(data) {
    const promise = data?.result
    if (!promise.then) {
      return promise
    }

    return promise.then((result) => {
      data.result = result
      this.channel.asyncEnd.publish(data)
      return result
    }).catch((err) => {
      data.error = err
      this.channel.asyncEnd.publish(data)
      return err
    })
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

    addLlmMeta({
      agent: this.agent,
      transaction: ctx.transaction,
      version: data.moduleVersion,
    })
  }
}

module.exports = OpenAIChatCompletions
