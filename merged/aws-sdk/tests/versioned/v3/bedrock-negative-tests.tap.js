/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
utils(tap)
const common = require('../common')
const createAiResponseServer = require('../aws-server-stubs/ai-server')
const { FAKE_CREDENTIALS } = require('../aws-server-stubs')
const sinon = require('sinon')

tap.beforeEach(async (t) => {
  const helper = utils.TestAgent.makeInstrumented()
  common.registerInstrumentation(helper)
  t.context.helper = helper

  const bedrock = require('@aws-sdk/client-bedrock-runtime')
  t.context.bedrock = bedrock

  const { server, baseUrl, responses, host, port } = await createAiResponseServer()
  t.context.server = server
  t.context.baseUrl = baseUrl
  t.context.responses = responses
  t.context.expectedExternalPath = (modelId) => `External/${host}:${port}/model/${modelId}/invoke`

  const client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl
  })
  sinon.spy(client.middlewareStack, 'add')
  t.context.client = client
})

tap.afterEach(async (t) => {
  t.context.helper.unload()
  t.context.server.destroy()
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes('@smithy/smithy-client') ||
      key.includes('@aws-sdk/smithy-client') ||
      key.includes('@aws-sdk/client-bedrock-runtime')
    ) {
      delete require.cache[key]
    }
  })
})
;[
  { aiMmonitoring: false, bedrockInstrumentation: true, name: 'ai_monitoring' },
  { aiMmonitoring: true, bedrockInstrumentation: false, name: 'aws_bedrock_instrumentation' },
  {
    aiMmonitoring: false,
    bedrockInstrumentation: false,
    name: 'aws_bedrock_instrumentation and ai_monitoring'
  }
].forEach(({ aiMonitoring, bedrockInstrumentation, name }) => {
  tap.test(`should not register instrumentation middleware when ${name} is not enabled`, (t) => {
    const { bedrock, client, responses, helper } = t.context
    const resKey = 'amazon'
    const modelId = 'amazon.titan-text-express-v1'
    helper.agent.config.ai_monitoring = aiMonitoring
    helper.agent.config.feature_flag.aws_bedrock_instrumentation = bedrockInstrumentation
    const prompt = `text ${resKey} ultimate question`
    const input = {
      body: JSON.stringify({ inputText: prompt }),
      modelId
    }

    const command = new bedrock.InvokeModelCommand(input)

    const expected = responses[resKey].get(prompt)
    helper.runInTransaction(async (tx) => {
      const response = await client.send(command)
      t.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
      t.equal(client.middlewareStack.add.callCount, 2)
      const fns = client.middlewareStack.add.args.map(([mw]) => mw.name)
      t.not(fns.includes('bound bedrockMiddleware'))
      tx.end()
      t.end()
    })
  })
})
