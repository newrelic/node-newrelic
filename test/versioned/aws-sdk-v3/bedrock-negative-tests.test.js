/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const sinon = require('sinon')
const { afterEach, getAiResponseServer } = require('./common')
const createAiResponseServer = getAiResponseServer()

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  const bedrock = require('@aws-sdk/client-bedrock-runtime')
  ctx.nr.bedrock = bedrock

  const { server, baseUrl, responses, host, port } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.baseUrl = baseUrl
  ctx.nr.responses = responses
  ctx.nr.expectedExternalPath = (modelId) => `External/${host}:${port}/model/${modelId}/invoke`

  const client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl
  })
  sinon.spy(client.middlewareStack, 'add')
  ctx.nr.client = client
})

test.afterEach(afterEach)

test('should not register instrumentation middleware when ai_monitoring is not enabled', async (t) => {
  const { bedrock, client, responses, agent } = t.nr
  const resKey = 'amazon'
  const modelId = 'amazon.titan-text-express-v1'
  agent.config.ai_monitoring.enabled = false
  const prompt = `text ${resKey} ultimate question`
  const input = {
    body: JSON.stringify({ inputText: prompt }),
    modelId
  }

  const command = new bedrock.InvokeModelCommand(input)

  const expected = responses[resKey].get(prompt)
  await helper.runInTransaction(agent, async (tx) => {
    const response = await client.send(command)
    assert.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
    assert.equal(client.middlewareStack.add.callCount, 2)
    const fns = client.middlewareStack.add.args.map(([mw]) => mw.name)
    assert.ok(!fns.includes('bound bedrockMiddleware'))
    tx.end()
  })
})
