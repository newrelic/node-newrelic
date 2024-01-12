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
const { DESTINATIONS } = require('../../../lib/util')
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
  const helper = utils.TestAgent.makeInstrumented({
    ai_monitoring: {
      enabled: true
    },
    feature_flag: {
      aws_bedrock_instrumentation: true
    }
  })
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
  { modelId: 'amazon.titan-embed-text-v1', resKey: 'amazon' },
  { modelId: 'cohere.embed-english-v3', resKey: 'cohere' }
].forEach(({ modelId, resKey }) => {
  tap.test(`${modelId}: should properly create embedding segment`, (t) => {
    const { bedrock, client, responses, helper, expectedExternalPath } = t.context
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)

    const command = new bedrock.InvokeModelCommand(input)

    const expected = responses[resKey].get(prompt)
    helper.runInTransaction(async (tx) => {
      const response = await client.send(command)
      const body = JSON.parse(response.body.transformToString('utf8'))
      t.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
      t.same(body, expected.body)
      t.segments(tx.trace.root, [
        {
          name: 'Llm/embedding/Bedrock/InvokeModelCommand',
          children: [{ name: expectedExternalPath(modelId) }]
        }
      ])
      tx.end()
      t.end()
    })
  })

  tap.test(`${modelId}: should properly create the LlmEmbedding event`, (t) => {
    const { bedrock, client, helper } = t.context
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    const { agent } = helper
    helper.runInTransaction(async (tx) => {
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
        'transaction_id': tx.id,
        'response.model': modelId,
        'vendor': 'bedrock',
        'ingest_source': 'Node',
        'request.model': modelId,
        'duration': tx.trace.root.children[0].getDurationInMillis(),
        'api_key_last_four_digits': 'E ID',
        'response.usage.total_tokens': 13,
        'response.usage.prompt_tokens': 13,
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
    const { bedrock, client, helper, expectedExternalPath } = t.context
    const prompt = `embed text ${resKey} error`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)
    const expectedMsg =
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
    const expectedType = 'ValidationException'

    const { agent } = helper
    helper.runInTransaction(async (tx) => {
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

      t.segments(tx.trace.root, [
        {
          name: 'Llm/embedding/Bedrock/InvokeModelCommand',
          children: [{ name: expectedExternalPath(modelId) }]
        }
      ])
      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 1)
      const embedding = events.filter(([{ type }]) => type === 'LlmEmbedding')[0]
      const expectedEmbedding = {
        'id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/,
        'appName': 'New Relic for Node.js tests',
        'request_id': '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
        'trace_id': tx.traceId,
        'span_id': tx.trace.root.children[0].id,
        'transaction_id': tx.id,
        'response.model': modelId,
        'vendor': 'bedrock',
        'ingest_source': 'Node',
        'request.model': modelId,
        'duration': tx.trace.root.children[0].getDurationInMillis(),
        'api_key_last_four_digits': 'E ID',
        'response.usage.total_tokens': 0,
        'response.usage.prompt_tokens': 0,
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
    const { bedrock, client, helper } = t.context
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    helper.runInTransaction(async (tx) => {
      await client.send(command)
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      t.end()
    })
  })
})
