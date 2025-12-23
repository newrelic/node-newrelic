/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')

const { removeModules } = require('../../lib/cache-buster')
const { match } = require('../../lib/custom-assertions')
const {
  runStreamingEnabledTests,
  runStreamingDisabledTest,
  runAiMonitoringDisabledTests
} = require('../langchain/runnables-streaming')
const { FAKE_CREDENTIALS, getAiResponseServer } = require('../../lib/aws-server-stubs')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true,
    streaming: {
      enabled: true
    }
  }
}
const createAiResponseServer = getAiResponseServer(path.join(__dirname, './'))

async function beforeEach({ enabled, ctx }) {
  ctx.nr = {}
  const { server, baseUrl } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  ctx.nr.agent.config.ai_monitoring.streaming.enabled = enabled

  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser, CommaSeparatedListOutputParser } = require('@langchain/core/output_parsers')
  const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
  const { ChatBedrockConverse } = require('@langchain/aws')
  const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime')
  ctx.nr.ChatPromptTemplate = ChatPromptTemplate
  ctx.nr.CommaSeparatedListOutputParser = CommaSeparatedListOutputParser
  ctx.nr.BaseCallbackHandler = BaseCallbackHandler
  ctx.nr.langchainCoreVersion = require('@langchain/core/package.json').version

  // Create the BedrockRuntimeClient with our mock endpoint
  const bedrockClient = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })

  ctx.nr.prompt = ChatPromptTemplate.fromMessages([['assistant', 'text converse ultimate question {topic}']])
  ctx.nr.model = new ChatBedrockConverse({
    streaming: true,
    model: 'anthropic.claude-instant-v1',
    region: 'us-east-1',
    client: bedrockClient
  })
  ctx.nr.outputParser = new StringOutputParser()
}

async function afterEach(ctx) {
  ctx.nr?.server?.destroy()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', '@langchain/aws', '@aws-sdk'])
}

test('streaming enabled', async (t) => {
  t.beforeEach((ctx) => beforeEach({ enabled: true, ctx }))
  t.afterEach((ctx) => afterEach(ctx))

  await runStreamingEnabledTests({
    inputData: { topic: 'streamed' },
    expectedInput: '{"topic":"streamed"}',
    expectedContent: () => 'This is a test.',
    errorPromptTemplate: ['assistant', 'text converse ultimate question streamed error'],
    errorFromStreamEventCount: 4,
    errorFromStreamLangchainEventCount: 2,
    errorFromStreamAssertion: (exceptions) => {
      assert.equal(exceptions.length, 2)
      for (const e of exceptions) {
        match(e, {
          customAttributes: {
            'error.message': /Internal server error during streaming/,
            completion_id: /[\w-]{36}/
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
    inputData: { topic: 'streamed' },
    expectedContent: () => 'This is a test.',
    streamingDisabledMessage: 'should increment streaming disabled in both langchain and bedrock'
  })(t)
})

test('ai_monitoring disabled', async (t) => {
  t.beforeEach((ctx) => beforeEach({ enabled: true, ctx }))
  t.afterEach((ctx) => afterEach(ctx))

  await runAiMonitoringDisabledTests({
    inputData: { topic: 'streamed' },
    expectedContent: () => 'This is a test.'
  })(t)
})
