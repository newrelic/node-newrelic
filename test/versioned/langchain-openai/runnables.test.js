/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
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
