/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { findSegment } = require('../../lib/metrics_helper')
const { assertSegments, match } = require('../../lib/custom-assertions')
const { FAKE_CREDENTIALS, getAiResponseServer } = require('../../lib/aws-server-stubs')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const afterEach = require('./test-utils/after-each.js')
const createAiResponseServer = getAiResponseServer(__dirname)
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

test('Embeddings', async (t) => {
  t.beforeEach(async (ctx) => {
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
    ctx.nr.responses = responses
    ctx.nr.expectedExternalPath = (modelId) => `External/${host}:${port}/model/${modelId}/invoke`

    ctx.nr.client = new bedrock.BedrockRuntimeClient({
      region: 'us-east-1',
      credentials: FAKE_CREDENTIALS,
      endpoint: baseUrl
    })
  })

  t.afterEach(afterEach)

  const tests = [
    { modelId: 'amazon.titan-embed-text-v1', resKey: 'amazon' },
    { modelId: 'cohere.embed-english-v3', resKey: 'cohere' }
  ]

  for (const data of tests) {
    const { modelId, resKey } = data
    await t.test(`${modelId}: should properly create embedding segment`, async (t) => {
      const { agent, bedrock, client, responses, expectedExternalPath } = t.nr
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

    await t.test(`${modelId}: should properly create the LlmEmbedding event`, async (t) => {
      const { agent, bedrock, client } = t.nr
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
          id: /[a-f0-9]{32}/,
          request_id: 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
          trace_id: tx.traceId,
          span_id: segment.id,
          'response.model': modelId,
          vendor: 'bedrock',
          ingest_source: 'Node',
          'request.model': modelId,
          duration: segment.getDurationInMillis(),
          input: prompt,
          'response.usage.total_tokens': 14
        }

        assert.equal(embedding[0].type, 'LlmEmbedding')
        match(embedding[1], expectedEmbedding)

        tx.end()
      })
    })

    // Amazon Bedrock does not currently support streaming responses for amazon titan embeddings
    // See: https://docs.aws.amazon.com/bedrock/latest/userguide/service_code_examples_bedrock-runtime_amazon_titan_text_embeddings.html
    await t.test(`${modelId}: text answer (streamed)`, { skip: resKey === 'amazon' }, async (t) => {
      const { agent, bedrock, client } = t.nr
      const prompt = `text ${resKey} ultimate question streamed`
      const input = requests[resKey](prompt, modelId)
      const command = new bedrock.InvokeModelWithResponseStreamCommand(input)
      function consumeStreamChunk() {
        // no-op function to consume stream chunks
      }

      await helper.runInTransaction(agent, async (tx) => {
        const response = await client.send(command)
        for await (const event of response.body) {
          // no-op iteration over the stream in order to exercise the instrumentation
          consumeStreamChunk(event)
        }

        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 1)
        const embedding = events.filter(([{ type }]) => type === 'LlmEmbedding')[0]
        const [segment] = tx.trace.getChildren(tx.trace.root.id)
        const expectedEmbedding = {
          id: /[a-f0-9]{32}/,
          request_id: 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
          trace_id: tx.traceId,
          span_id: segment.id,
          'response.model': modelId,
          vendor: 'bedrock',
          ingest_source: 'Node',
          'request.model': modelId,
          duration: segment.getDurationInMillis(),
          input: prompt,
          'response.usage.total_tokens': 23
        }

        assert.equal(embedding[0].type, 'LlmEmbedding')
        match(embedding[1], expectedEmbedding)

        tx.end()
      })
    })

    await t.test(`${modelId}: should properly create errors on embeddings`, async (t) => {
      const { agent, bedrock, client, expectedExternalPath } = t.nr
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
            embedding_id: /[a-f0-9]{32}/
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
          id: /[a-f0-9]{32}/,
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

    await t.test(`${modelId}: should add llm attribute to transaction`, async (t) => {
      const { agent, bedrock, client } = t.nr
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

    await t.test(`${modelId}: should decorate messages with custom attrs`, async (t) => {
      const { agent, bedrock, client } = t.nr
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

    await t.test(`${modelId}: should not create segment or llm events when ai_monitoring.enabled is false`, async (t) => {
      const { agent, bedrock, client, expectedExternalPath } = t.nr
      agent.config.ai_monitoring.enabled = false
      const prompt = `embed text ${resKey} success`
      const input = requests[resKey](prompt, modelId)
      const command = new bedrock.InvokeModelCommand(input)

      await helper.runInTransaction(agent, async (tx) => {
        await client.send(command)
        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 0, 'should not create llm events when ai_monitoring is disabled')
        assert.ok(
          !findSegment(tx.trace, tx.trace.root, 'Llm/embedding/Bedrock/InvokeModelCommand'),
          'should not create Llm embedding segment when ai_monitoring is disabled'
        )
        // the external call should still happen, just without the Llm wrapper segment
        assert.ok(findSegment(tx.trace, tx.trace.root, expectedExternalPath(modelId)))
        tx.end()
      })
    })

    await t.test(`${modelId}: should create segment and LlmEmbedding event when ai_monitoring is disabled at instrumentation but enabled before the call`, async (t) => {
      // tear down the enabled agent/module set up in `beforeEach`
      t.nr.server.destroy()
      helper.unloadAgent(t.nr.agent)
      Object.keys(require.cache).forEach((key) => {
        if (key.includes('@aws-sdk') || key.includes('@smithy')) {
          delete require.cache[key]
        }
      })

      // set up the agent instance with ai_monitoring disabled
      const agent = helper.instrumentMockedAgent({
        ai_monitoring: {
          enabled: false
        }
      })
      t.nr.agent = agent
      const bedrock = require('@aws-sdk/client-bedrock-runtime')
      const { server, baseUrl } = await createAiResponseServer()
      t.nr.server = server
      const client = new bedrock.BedrockRuntimeClient({
        region: 'us-east-1',
        credentials: FAKE_CREDENTIALS,
        endpoint: baseUrl
      })

      const prompt = `embed text ${resKey} success`
      const input = requests[resKey](prompt, modelId)
      const command = new bedrock.InvokeModelCommand(input)

      // enable ai_monitoring before making the first `.send()` call
      agent.config.ai_monitoring.enabled = true
      await helper.runInTransaction(agent, async (tx) => {
        await client.send(command)
        const events = agent.customEventAggregator.events.toArray()
        assert.ok(events.length > 0, 'should create llm events when ai_monitoring is enabled before the call')
        const embedding = events.filter(([{ type }]) => type === 'LlmEmbedding')[0]
        assert.equal(embedding[0].type, 'LlmEmbedding')
        assert.ok(
          findSegment(tx.trace, tx.trace.root, 'Llm/embedding/Bedrock/InvokeModelCommand'),
          'should create Llm embedding segment when ai_monitoring is enabled before the call'
        )
        tx.end()
      })
    })
  }
})
