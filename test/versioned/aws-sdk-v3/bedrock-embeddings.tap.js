/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
require('./common')
const helper = require('../../lib/agent_helper')
require('../../lib/metrics_helper')
const createAiResponseServer = require('../../lib/aws-server-stubs/ai-server')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const requests = {
  amazon: (prompt, modelId) => ({
    body: JSON.stringify({ inputText: prompt }),
    modelId
  }),
  cohere: (prompt, modelId) => ({
    body: JSON.stringify({ input_type: 'search_document', texts: prompt.split(' ') }),
    modelId
  })
}

tap.beforeEach(async (t) => {
  t.context.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: true
    }
  })

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
  t.context.client = client
})

tap.afterEach(async (t) => {
  helper.unloadAgent(t.context.agent)
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
  { modelId: 'amazon.titan-embed-text-v1', resKey: 'amazon' },
  { modelId: 'cohere.embed-english-v3', resKey: 'cohere' }
].forEach(({ modelId, resKey }) => {
  tap.test(`${modelId}: should properly create embedding segment`, (t) => {
    const { bedrock, client, responses, agent, expectedExternalPath } = t.context
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)

    const command = new bedrock.InvokeModelCommand(input)

    const expected = responses[resKey].get(prompt)
    helper.runInTransaction(agent, async (tx) => {
      const response = await client.send(command)
      const body = JSON.parse(response.body.transformToString('utf8'))
      t.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
      t.same(body, expected.body)
      t.assertSegments(
        tx.trace.root,
        ['Llm/embedding/Bedrock/InvokeModelCommand', [expectedExternalPath(modelId)]],
        { exact: false }
      )
      tx.end()
      t.end()
    })
  })

  tap.test(`${modelId}: should properly create the LlmEmbedding event`, (t) => {
    const { bedrock, client, agent } = t.context
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    helper.runInTransaction(agent, async (tx) => {
      await client.send(command)
      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 1)
      const embedding = events.filter(([{ type }]) => type === 'LlmEmbedding')[0]
      const expectedEmbedding = {
        'id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/,
        'appName': 'New Relic for Node.js tests',
        'request_id': '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
        'trace_id': tx.traceId,
        'span_id': tx.trace.root.children[0].id,
        'response.model': modelId,
        'vendor': 'bedrock',
        'ingest_source': 'Node',
        'request.model': modelId,
        'duration': tx.trace.root.children[0].getDurationInMillis(),
        'input': prompt,
        'error': false
      }

      t.equal(embedding[0].type, 'LlmEmbedding')
      t.match(embedding[1], expectedEmbedding, 'should match embedding message')

      tx.end()
      t.end()
    })
  })

  tap.test(`${modelId}: text answer (streamed)`, async (t) => {
    const { bedrock, client, responses } = t.context
    const prompt = `text ${resKey} ultimate question streamed`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

    const expected = responses[resKey].get(prompt)
    try {
      await client.send(command)
    } catch (error) {
      t.equal(error.message, expected.body.message)
    }
  })

  tap.test(`${modelId}: should properly create errors on embeddings`, (t) => {
    const { bedrock, client, agent, expectedExternalPath } = t.context
    const prompt = `embed text ${resKey} error`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)
    const expectedMsg =
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
    const expectedType = 'ValidationException'

    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.send(command)
      } catch (err) {
        t.equal(err.message, expectedMsg)
        t.equal(err.name, expectedType)
      }
      t.equal(tx.exceptions.length, 1)
      t.match(tx.exceptions[0], {
        error: {
          name: expectedType,
          message: expectedMsg
        },
        customAttributes: {
          'http.statusCode': 400,
          'error.message': expectedMsg,
          'error.code': expectedType,
          'embedding_id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/
        },
        agentAttributes: {
          spanId: /[\w\d]+/
        }
      })

      t.assertSegments(
        tx.trace.root,
        ['Llm/embedding/Bedrock/InvokeModelCommand', [expectedExternalPath(modelId)]],
        { exact: false }
      )
      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 1)
      const embedding = events.filter(([{ type }]) => type === 'LlmEmbedding')[0]
      const expectedEmbedding = {
        'id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/,
        'appName': 'New Relic for Node.js tests',
        'request_id': '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
        'trace_id': tx.traceId,
        'span_id': tx.trace.root.children[0].id,
        'response.model': modelId,
        'vendor': 'bedrock',
        'ingest_source': 'Node',
        'request.model': modelId,
        'duration': tx.trace.root.children[0].getDurationInMillis(),
        'input': prompt,
        'error': true
      }

      t.equal(embedding[0].type, 'LlmEmbedding')
      t.match(embedding[1], expectedEmbedding, 'should match embedding message')

      tx.end()
      t.end()
    })
  })

  tap.test(`${modelId}: should add llm attribute to transaction`, (t) => {
    const { bedrock, client, agent } = t.context
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    helper.runInTransaction(agent, async (tx) => {
      await client.send(command)
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      t.end()
    })
  })

  tap.test(`${modelId}: should decorate messages with custom attrs`, (t) => {
    const { bedrock, client, agent } = t.context
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    helper.runInTransaction(agent, async (tx) => {
      const api = helper.getAgentApi()
      api.addCustomAttribute('llm.foo', 'bar')

      await client.send(command)
      const events = tx.agent.customEventAggregator.events.toArray()
      const msg = events[0][1]
      t.equal(msg['llm.foo'], 'bar')

      tx.end()
      t.end()
    })
  })
})

tap.test('should utilize tokenCountCallback when set', (t) => {
  t.plan(3)

  const { bedrock, client, agent } = t.context
  const prompt = 'embed text amazon token count callback response'
  const modelId = 'amazon.titan-embed-text-v1'
  const input = requests.amazon(prompt, modelId)

  agent.config.ai_monitoring.record_content.enabled = false
  agent.llm.tokenCountCallback = function (model, content) {
    t.equal(model, modelId)
    t.equal(content, prompt)
    return content?.split(' ')?.length
  }
  const command = new bedrock.InvokeModelCommand(input)

  helper.runInTransaction(agent, async (tx) => {
    await client.send(command)

    const events = agent.customEventAggregator.events.toArray()
    const embeddings = events.filter((e) => e[0].type === 'LlmEmbedding')
    const msg = embeddings[0][1]
    t.equal(msg.token_count, 7)

    tx.end()
    t.end()
  })
})
