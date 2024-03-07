/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const common = module.exports
const createOpenAIMockServer = require('./mock-server')
const helper = require('../../lib/agent_helper')
const config = {
  ai_monitoring: {
    enabled: true
  },
  streaming: {
    enabled: true
  }
}

common.beforeHook = async function beforeHook(t) {
  const { host, port, server } = await createOpenAIMockServer()
  t.context.host = host
  t.context.port = port
  t.context.server = server
  t.context.agent = helper.instrumentMockedAgent(config)
  const OpenAI = require('openai')
  t.context.client = new OpenAI({
    apiKey: 'fake-versioned-test-key',
    baseURL: `http://${host}:${port}`
  })
}

common.afterEachHook = function afterEachHook(t) {
  t.context.agent.customEventAggregator.clear()
}

common.afterHook = function afterHook(t) {
  t.context?.server?.close()
  t.context.agent && helper.unloadAgent(t.context.agent)
}

function assertChatCompletionMessages({
  tx,
  chatMsgs,
  id,
  model,
  reqContent,
  resContent,
  tokenUsage
}) {
  const baseMsg = {
    'appName': 'New Relic for Node.js tests',
    'request_id': '49dbbffbd3c3f4612aa48def69059aad',
    'trace_id': tx.traceId,
    'span_id': tx.trace.root.children[0].id,
    'transaction_id': tx.id,
    'response.model': model,
    'vendor': 'openai',
    'ingest_source': 'Node',
    'role': 'user',
    'is_response': false,
    'completion_id': /[a-f0-9]{36}/
  }

  chatMsgs.forEach((msg) => {
    const expectedChatMsg = { ...baseMsg }
    if (msg[1].sequence === 0) {
      expectedChatMsg.sequence = 0
      expectedChatMsg.id = `${id}-0`
      expectedChatMsg.content = reqContent
      if (tokenUsage) {
        expectedChatMsg.token_count = 53
      }
    } else if (msg[1].sequence === 1) {
      expectedChatMsg.sequence = 1
      expectedChatMsg.id = `${id}-1`
      expectedChatMsg.content = 'What does 1 plus 1 equal?'
      if (tokenUsage) {
        expectedChatMsg.token_count = 53
      }
    } else {
      expectedChatMsg.sequence = 2
      expectedChatMsg.role = 'assistant'
      expectedChatMsg.id = `${id}-2`
      expectedChatMsg.content = resContent
      expectedChatMsg.is_response = true
      if (tokenUsage) {
        expectedChatMsg.token_count = 11
      }
    }

    this.equal(msg[0].type, 'LlmChatCompletionMessage')
    this.match(msg[1], expectedChatMsg, 'should match chat completion message')
  })
}

function assertChatCompletionSummary({ tx, model, chatSummary, tokenUsage, error = false }) {
  let expectedChatSummary = {
    'id': /[a-f0-9]{36}/,
    'appName': 'New Relic for Node.js tests',
    'request_id': '49dbbffbd3c3f4612aa48def69059aad',
    'trace_id': tx.traceId,
    'span_id': tx.trace.root.children[0].id,
    'transaction_id': tx.id,
    'response.model': model,
    'vendor': 'openai',
    'ingest_source': 'Node',
    'request.model': model,
    'duration': tx.trace.root.children[0].getDurationInMillis(),
    'response.organization': 'new-relic-nkmd8b',
    'response.headers.llmVersion': '2020-10-01',
    'response.headers.ratelimitLimitRequests': '200',
    'response.headers.ratelimitLimitTokens': '40000',
    'response.headers.ratelimitResetTokens': '90ms',
    'response.headers.ratelimitRemainingTokens': '39940',
    'response.headers.ratelimitRemainingRequests': '199',
    'response.number_of_messages': 3,
    'response.choices.finish_reason': 'stop',
    'error': error
  }

  if (tokenUsage) {
    expectedChatSummary = {
      ...expectedChatSummary,
      'response.usage.total_tokens': 64,
      'response.usage.prompt_tokens': 53,
      'response.usage.completion_tokens': 11
    }
  }

  this.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  this.match(chatSummary[1], expectedChatSummary, 'should match chat summary message')
}

tap.Test.prototype.addAssert('llmMessages', 1, assertChatCompletionMessages)
tap.Test.prototype.addAssert('llmSummary', 1, assertChatCompletionSummary)
