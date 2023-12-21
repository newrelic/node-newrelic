/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const common = require('../common')
const { createAiResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')
const bedrockPath = require.resolve('@aws-sdk/client-bedrock-runtime')

tap.beforeEach(async (t) => {
  const helper = utils.TestAgent.makeInstrumented()
  common.registerInstrumentation(helper)
  t.context.helper = helper

  delete require.cache[bedrockPath]
  const bedrock = require(bedrockPath)
  t.context.bedrock = bedrock

  const { server, baseUrl, responses } = await createAiResponseServer()
  t.context.server = server
  t.context.baseUrl = baseUrl
  t.context.responses = responses

  const client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl
  })
  t.context.client = client
})

tap.afterEach(async (t) => {
  t.context.helper.unload()
  t.context.server.destroy()
})

tap.test('successful text answer', async (t) => {
  const { bedrock, client, responses } = t.context
  const prompt = 'ultimate question'
  const command = new bedrock.InvokeModelCommand({
    body: JSON.stringify({ prompt }),
    modelId: 'ai21.j2-ultra-v1'
  })

  const expected = responses.ai21.get(prompt)
  const response = await client.send(command)
  const body = JSON.parse(response.body.transformToString('utf8'))
  t.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
  t.same(body, expected.body)
})

tap.test('text answer (streamed)', async (t) => {
  const { bedrock, client, responses } = t.context
  const prompt = 'ultimate question streamed'
  const command = new bedrock.InvokeModelWithResponseStreamCommand({
    body: JSON.stringify({ prompt }),
    modelId: 'ai21.j2-ultra-v1'
  })

  const expected = responses.ai21.get(prompt)
  try {
    await client.send(command)
  } catch (error) {
    t.equal(error.message, expected.body.message)
  }
})
