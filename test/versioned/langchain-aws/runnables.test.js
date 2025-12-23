/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const path = require('node:path')

const { removeModules } = require('../../lib/cache-buster')
const { runRunnablesTests } = require('../langchain/runnables')
const { FAKE_CREDENTIALS, getAiResponseServer } = require('../../lib/aws-server-stubs')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}
const createAiResponseServer = getAiResponseServer(path.join(__dirname, './'))

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { server, baseUrl } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser } = require('@langchain/core/output_parsers')
  const { ChatBedrockConverse } = require('@langchain/aws')
  const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime')

  // Create the BedrockRuntimeClient with our mock endpoint
  const bedrockClient = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })

  ctx.nr.prompt = ChatPromptTemplate.fromMessages([['assistant', 'text converse ultimate {topic}']])
  ctx.nr.model = new ChatBedrockConverse({
    model: 'anthropic.claude-3-haiku-20240307-v1:0',
    region: 'us-east-1',
    client: bedrockClient
  })
  ctx.nr.outputParser = new StringOutputParser()
})

test.afterEach(async (ctx) => {
  ctx.nr?.server?.destroy()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', '@langchain/aws', '@aws-sdk'])
})

runRunnablesTests({
  inputData: { topic: 'question' },
  expectedInput: '{"topic":"question"}',
  expectedOutput: 'This is a test.',
  errorPromptTemplate: ['assistant', 'text converse ultimate question error'],
  errorEventCount: 5,
  arrayParserOutput: '["This is a test."]'
})
