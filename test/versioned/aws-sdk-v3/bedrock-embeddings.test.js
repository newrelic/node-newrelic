/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { assertSegments, match } = require('../../lib/custom-assertions')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const { afterEach, getAiResponseServer } = require('./common')
const createAiResponseServer = getAiResponseServer()
const requests = {
  amazon: (prompt, modelId) => {
    return {
      body: JSON.stringify({ inputText: prompt }),
      modelId
    }
  },
  cohere: (prompt, modelId) => {
    return {
      body: JSON.stringify({ input_type: 'search_document', texts: prompt.split(' ') }),
      modelId
    }
  }
}
const { tspl } = require('@matteo.collina/tspl')

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
  ctx.nr.expectedExternalPath = (modelId) => `External/${host}:${port}/model/${modelId}/invoke`

  const client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl
  })
  ctx.nr.client = client
})

test.afterEach(afterEach)
;[
  { modelId: 'amazon.titan-embed-text-v1', resKey: 'amazon' },
  { modelId: 'cohere.embed-english-v3', resKey: 'cohere' }
].forEach(({ modelId, resKey }) => {
  test(`${modelId}: should properly create embedding segment`, async (t) => {
    const { bedrock, client, responses, agent, expectedExternalPath } = t.nr
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)

    const command = new bedrock.InvokeModelCommand(input)

    const expected = responses[resKey].get(prompt)
    await helper.runInTransaction(agent, async (tx) => {
      const response = await client.send(command)
      const body = JSON.parse(response.body.transformToString('utf8'))
      assert.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
      assert.deepEqual(body, expected.body)
      assertSegments(
        tx.trace,
        tx.trace.root,
        ['Llm/embedding/Bedrock/InvokeModelCommand', [expectedExternalPath(modelId)]],
        { exact: false }
      )
      tx.end()
    })
  })

  test(`${modelId}: should properly create the LlmEmbedding event`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    await helper.runInTransaction(agent, async (tx) => {
      await client.send(command)
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 1)
      const embedding = events.filter(([{ type }]) => type === 'LlmEmbedding')[0]
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
      const expectedEmbedding = {
        id: /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/,
        appName: 'New Relic for Node.js tests',
        request_id: '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
        trace_id: tx.traceId,
        span_id: segment.id,
        'response.model': modelId,
        vendor: 'bedrock',
        ingest_source: 'Node',
        'request.model': modelId,
        duration: segment.getDurationInMillis(),
        input: prompt,
        error: false
      }

      assert.equal(embedding[0].type, 'LlmEmbedding')
      match(embedding[1], expectedEmbedding)

      tx.end()
    })
  })

  test(`${modelId}: text answer (streamed)`, async (t) => {
    const { bedrock, client, responses } = t.nr
    const prompt = `text ${resKey} ultimate question streamed`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

    const expected = responses[resKey].get(prompt)
    try {
      await client.send(command)
    } catch (error) {
      assert.equal(error.message, expected.body.message)
    }
  })

  test(`${modelId}: should properly create errors on embeddings`, async (t) => {
    const { bedrock, client, agent, expectedExternalPath } = t.nr
    const prompt = `embed text ${resKey} error`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)
    const expectedMsg =
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
    const expectedType = 'ValidationException'

    await helper.runInTransaction(agent, async (tx) => {
      try {
        await client.send(command)
      } catch (err) {
        assert.equal(err.message, expectedMsg)
        assert.equal(err.name, expectedType)
      }
      assert.equal(tx.exceptions.length, 1)
      match(tx.exceptions[0], {
        error: {
          name: expectedType,
          message: expectedMsg
        },
        customAttributes: {
          'http.statusCode': 400,
          'error.message': expectedMsg,
          'error.code': expectedType,
          embedding_id: /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/
        },
        agentAttributes: {
          spanId: /\w+/
        }
      })

      assertSegments(
        tx.trace,
        tx.trace.root,
        ['Llm/embedding/Bedrock/InvokeModelCommand', [expectedExternalPath(modelId)]],
        { exact: false }
      )
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 1)
      const embedding = events.filter(([{ type }]) => type === 'LlmEmbedding')[0]
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
      const expectedEmbedding = {
        id: /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/,
        appName: 'New Relic for Node.js tests',
        request_id: '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
        trace_id: tx.traceId,
        span_id: segment.id,
        'response.model': modelId,
        vendor: 'bedrock',
        ingest_source: 'Node',
        'request.model': modelId,
        duration: segment.getDurationInMillis(),
        input: prompt,
        error: true
      }

      assert.equal(embedding[0].type, 'LlmEmbedding')
      match(embedding[1], expectedEmbedding)

      tx.end()
    })
  })

  test(`${modelId}: should add llm attribute to transaction`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    await helper.runInTransaction(agent, async (tx) => {
      await client.send(command)
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      assert.equal(attributes.llm, true)

      tx.end()
    })
  })

  test(`${modelId}: should decorate messages with custom attrs`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `embed text ${resKey} success`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    await helper.runInTransaction(agent, async (tx) => {
      const api = helper.getAgentApi()
      api.addCustomAttribute('llm.foo', 'bar')

      await client.send(command)
      const events = tx.agent.customEventAggregator.events.toArray()
      const msg = events[0][1]
      assert.equal(msg['llm.foo'], 'bar')

      tx.end()
    })
  })
})

test('should utilize tokenCountCallback when set', async (t) => {
  const plan = tspl(t, { plan: 3 })

  const { bedrock, client, agent } = t.nr
  const prompt = 'embed text amazon token count callback response'
  const modelId = 'amazon.titan-embed-text-v1'
  const input = requests.amazon(prompt, modelId)

  agent.config.ai_monitoring.record_content.enabled = false
  agent.llm.tokenCountCallback = function (model, content) {
    plan.equal(model, modelId)
    plan.equal(content, prompt)
    return content?.split(' ')?.length
  }
  const command = new bedrock.InvokeModelCommand(input)

  await helper.runInTransaction(agent, async (tx) => {
    await client.send(command)

    const events = agent.customEventAggregator.events.toArray()
    const embeddings = events.filter((e) => e[0].type === 'LlmEmbedding')
    const msg = embeddings[0][1]
    plan.equal(msg.token_count, 7)

    tx.end()
  })
})
