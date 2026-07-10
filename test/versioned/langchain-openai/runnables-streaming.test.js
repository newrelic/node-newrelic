/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { match } = require('../../lib/custom-assertions')
const { findSegment } = require('../../lib/metrics_helper')
const {
  runStreamingEnabledTests,
  runStreamingDisabledTest,
  runAiMonitoringDisabledTests
} = require('../langchain/runnables-streaming')
const createOpenAIMockServer = require('../openai/mock-server')
const mockResponses = require('../openai/mock-chat-api-responses')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true,
    streaming: {
      enabled: true
    }
  }
}

async function beforeEach({ enabled, ctx }) {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.server = server
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  ctx.nr.agent.config.ai_monitoring.streaming.enabled = enabled

  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser, CommaSeparatedListOutputParser } = require('@langchain/core/output_parsers')
  const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
  const { ChatOpenAI } = require('@langchain/openai')
  ctx.nr.ChatPromptTemplate = ChatPromptTemplate
  ctx.nr.CommaSeparatedListOutputParser = CommaSeparatedListOutputParser
  ctx.nr.BaseCallbackHandler = BaseCallbackHandler
  ctx.nr.langchainCoreVersion = require('@langchain/core/package.json').version

  ctx.nr.prompt = ChatPromptTemplate.fromMessages([['assistant', '{topic} response']])
  ctx.nr.model = new ChatOpenAI({
    streaming: true,
    apiKey: 'fake-key',
    maxRetries: 0,
    configuration: {
      baseURL: `http://${host}:${port}`
    }
  })
  ctx.nr.outputParser = new StringOutputParser()
}

async function afterEach(ctx) {
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', 'openai'])
}

test('streaming enabled', async (t) => {
  t.beforeEach((ctx) => beforeEach({ enabled: true, ctx }))
  t.afterEach((ctx) => afterEach(ctx))

  await runStreamingEnabledTests({
    inputData: { topic: 'Streamed' },
    expectedInput: '{"topic":"Streamed"}',
    expectedContent: () => mockResponses.get('Streamed response').streamData,
    errorPromptTemplate: ['assistant', '{topic} stream'],
    errorFromInputAssertion: (exceptions) => {
      for (const e of exceptions) {
        const str = Object.prototype.toString.call(e.customAttributes)
        assert.equal(str, '[object LlmErrorMessage]')
      }
    },
    errorFromStreamAssertion: (exceptions) => {
      for (const e of exceptions) {
        // skip the socket error as it is not related to LLM
        // this started occurring when openai used undici as the HTTP client
        if (e.error.code === 'UND_ERR_SOCKET') {
          continue
        }
        const str = Object.prototype.toString.call(e.customAttributes)
        assert.equal(str, '[object LlmErrorMessage]')
        match(e, {
          customAttributes: {
            'error.message': /(?:Premature close)|(?:terminated)/,
            completion_id: /\w{32}/
          }
        })
      }
    }
  })(t)
})

test('streaming disabled', async (t) => {
  t.beforeEach((ctx) => beforeEach({ enabled: false, ctx }))
  t.afterEach((ctx) => afterEach(ctx))

  await runStreamingDisabledTest({
    inputData: { topic: 'Streamed' },
    expectedContent: () => mockResponses.get('Streamed response').streamData,
    streamingDisabledMessage: 'should increment streaming disabled in both langchain and openai'
  })(t)
})

test('ai_monitoring disabled', async (t) => {
  t.beforeEach((ctx) => beforeEach({ enabled: true, ctx }))
  t.afterEach((ctx) => afterEach(ctx))

  await runAiMonitoringDisabledTests({
    inputData: { topic: 'Streamed' },
    expectedContent: () => mockResponses.get('Streamed response').streamData
  })(t)
})

test('should create segment and llm events in stream when ai_monitoring is disabled at instrumentation but enabled before the call', async (t) => {
  // set up an enabled agent + mock server so we can reuse the still-open server
  await beforeEach({ enabled: true, ctx: t })
  t.after((ctx) => afterEach(ctx))

  const { host, port } = t.nr
  // tear down the enabled agent/module set up above
  helper.unloadAgent(t.nr.agent)
  removeModules(['@langchain/core', 'openai'])

  // set up the agent instance with ai_monitoring disabled but streaming enabled
  const agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: false,
      streaming: {
        enabled: true
      }
    }
  })
  t.nr.agent = agent

  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser } = require('@langchain/core/output_parsers')
  const { ChatOpenAI } = require('@langchain/openai')
  const prompt = ChatPromptTemplate.fromMessages([['assistant', '{topic} response']])
  const model = new ChatOpenAI({
    streaming: true,
    apiKey: 'fake-key',
    maxRetries: 0,
    configuration: {
      baseURL: `http://${host}:${port}`
    }
  })
  const outputParser = new StringOutputParser()

  // enable ai_monitoring before making the call
  agent.config.ai_monitoring.enabled = true
  await new Promise((resolve) => {
    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model).pipe(outputParser)
      const stream = await chain.stream({ topic: 'Streamed' })
      let content = ''
      for await (const chunk of stream) {
        content += chunk
      }
      assert.ok(content.length > 0, 'should receive streamed content')

      const events = agent.customEventAggregator.events.toArray()
      assert.ok(events.length > 0, 'should create llm events when ai_monitoring is enabled before the call')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })
      assert.ok(langchainEvents.length > 0, 'should create langchain events when ai_monitoring is enabled before the call')

      assert.ok(findSegment(tx.trace, tx.trace.root, 'Llm/chain/LangChain/stream'), 'should create the stream segment')

      tx.end()
      resolve()
    })
  })
})
