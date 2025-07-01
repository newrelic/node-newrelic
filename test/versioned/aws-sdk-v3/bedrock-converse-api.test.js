/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const {
  afterEach
} = require('./common')
const helper = require('../../lib/agent_helper')
const createAiResponseServer = require('../../lib/aws-server-stubs/ai-server')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { assertSegments } = require('../../lib/custom-assertions')
const responseConstants = require('../../lib/aws-server-stubs/ai-server/responses/constants')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: true
    }
  })
  const bedrock = require('@aws-sdk/client-bedrock-runtime')
  ctx.nr.bedrock = bedrock

  const { server, baseUrl, responses, host, port } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.baseUrl = baseUrl
  ctx.nr.responses = responses
  ctx.nr.expectedExternalPath = (modelId, method = 'converse') =>
    `External/${host}:${port}/model/${encodeURIComponent(modelId)}/${method}`

  const client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })
  ctx.nr.client = client
})

test.afterEach(afterEach)

test('should properly create completion segment', async (t) => {
  const modelId = 'anthropic.claude-instant-v1'
  const { bedrock, client, agent, expectedExternalPath } = t.nr
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }

  const command = new bedrock.ConverseCommand(input)

  const expected = { headers: { 'x-amzn-requestid': responseConstants.reqId } }
  await helper.runInTransaction(agent, async (tx) => {
    const response = await client.send(command)
    assert.ok(response?.output?.message?.content?.[0]?.text)
    assert.equal(response?.$metadata?.requestId, expected?.headers['x-amzn-requestid'])
    assertSegments(
      tx.trace,
      tx.trace.root,
      ['Llm/completion/Bedrock/ConverseCommand', [expectedExternalPath(modelId)]],
      { exact: false }
    )
    tx.end()
  })
})
