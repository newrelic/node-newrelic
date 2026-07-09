/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { findSegment } = require('../../lib/metrics_helper')
const { runRunnablesTests } = require('../langchain/runnables')
const createOpenAIMockServer = require('../openai/mock-server')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.server = server
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser, CommaSeparatedListOutputParser } = require('@langchain/core/output_parsers')
  const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
  const { ChatOpenAI } = require('@langchain/openai')
  ctx.nr.ChatPromptTemplate = ChatPromptTemplate
  ctx.nr.CommaSeparatedListOutputParser = CommaSeparatedListOutputParser
  ctx.nr.BaseCallbackHandler = BaseCallbackHandler
  ctx.nr.langchainCoreVersion = require('@langchain/core/package.json').version

  ctx.nr.prompt = ChatPromptTemplate.fromMessages([['assistant', 'You are a {topic}.']])
  ctx.nr.model = new ChatOpenAI({
    apiKey: 'fake-key',
    maxRetries: 0,
    configuration: {
      baseURL: `http://${host}:${port}`
    }
  })
  ctx.nr.outputParser = new StringOutputParser()
})

test.afterEach(async (ctx) => {
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', 'openai'])
})

runRunnablesTests({
  inputData: { topic: 'scientist' },
  arrayParserOutput: '["212 degrees Fahrenheit is equal to 100 degrees Celsius."]',
  errorPromptTemplate: ['assistant', 'Invalid API key.'],
  errorAssertion: (exceptions) => {
    for (const e of exceptions) {
      const str = Object.prototype.toString.call(e.customAttributes)
      assert.equal(str, '[object LlmErrorMessage]')
    }
  }
})

test('should create segment and llm events when ai_monitoring is disabled at instrumentation but enabled before the call', (t, end) => {
  const { host, port } = t.nr
  // tear down the enabled agent/module set up in `beforeEach`
  helper.unloadAgent(t.nr.agent)
  removeModules(['@langchain/core', 'openai'])

  // set up the agent instance with ai_monitoring disabled
  const agent = helper.instrumentMockedAgent({ ai_monitoring: { enabled: false } })
  t.nr.agent = agent

  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser } = require('@langchain/core/output_parsers')
  const { ChatOpenAI } = require('@langchain/openai')
  const prompt = ChatPromptTemplate.fromMessages([['assistant', 'You are a {topic}.']])
  const model = new ChatOpenAI({
    apiKey: 'fake-key',
    maxRetries: 0,
    configuration: {
      baseURL: `http://${host}:${port}`
    }
  })
  const outputParser = new StringOutputParser()

  // enable ai_monitoring before making the call
  agent.config.ai_monitoring.enabled = true
  helper.runInTransaction(agent, async (tx) => {
    const chain = prompt.pipe(model).pipe(outputParser)
    const result = await chain.invoke({ topic: 'scientist' })
    assert.ok(result)

    const events = agent.customEventAggregator.events.toArray()
    assert.ok(events.length > 0, 'should create llm events when ai_monitoring is enabled before the call')

    const langchainEvents = events.filter((event) => {
      const [, chainEvent] = event
      return chainEvent.vendor === 'langchain'
    })
    assert.ok(langchainEvents.length > 0, 'should create langchain events when ai_monitoring is enabled before the call')

    assert.ok(findSegment(tx.trace, tx.trace.root, 'Llm/chain/LangChain/invoke'), 'should create the invoke segment')

    tx.end()
    end()
  })
})
