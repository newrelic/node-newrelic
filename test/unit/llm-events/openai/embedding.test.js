/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmEmbedding = require('../../../../lib/llm-events/openai/embedding')
const helper = require('../../../lib/agent_helper')
const { res, getExpectedResult } = require('./common-chat-api')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should properly create a LlmEmbedding event', (t, end) => {
  const { agent } = t.nr
  const req = {
    input: 'This is my test input',
    model: 'gpt-3.5-turbo-0613'
  }

  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const embeddingEvent = new LlmEmbedding({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res
      })
      const expected = getExpectedResult(tx, embeddingEvent, 'embedding')
      assert.deepEqual(embeddingEvent, expected)
      end()
    })
  })
})
;[
  { type: 'string', value: 'test input', expected: 'test input' },
  {
    type: 'array of strings',
    value: ['test input', 'test input2'],
    expected: 'test input,test input2'
  },
  { type: 'array of numbers', value: [1, 2, 3, 4], expected: '1,2,3,4' },
  {
    type: 'array of array of numbers',
    value: [
      [1, 2],
      [3, 4],
      [5, 6]
    ],
    expected: '1,2,3,4,5,6'
  }
].forEach(({ type, value, expected }) => {
  test(`should properly serialize input when it is a ${type}`, (t, end) => {
    const { agent } = t.nr
    const embeddingEvent = new LlmEmbedding({
      agent,
      segment: null,
      transaction: null,
      request: { input: value },
      response: {}
    })
    assert.equal(embeddingEvent.input, expected)
    end()
  })
})

test('should set error to true', (t, end) => {
  const { agent } = t.nr
  const req = {
    input: 'This is my test input',
    model: 'gpt-3.5-turbo-0613'
  }

  const api = helper.getAgentApi()
  helper.runInTransaction(agent, () => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const embeddingEvent = new LlmEmbedding({
        agent,
        segment,
        request: req,
        response: res,
        withError: true
      })
      assert.equal(true, embeddingEvent.error)
      end()
    })
  })
})

test('respects record_content', (t, end) => {
  const { agent } = t.nr
  const req = {
    input: 'This is my test input',
    model: 'gpt-3.5-turbo-0613'
  }
  agent.config.ai_monitoring.record_content.enabled = false

  const api = helper.getAgentApi()
  helper.runInTransaction(agent, () => {
    const segment = api.shim.getActiveSegment()
    const embeddingEvent = new LlmEmbedding({
      agent,
      segment,
      request: req,
      response: res
    })
    assert.equal(embeddingEvent.input, undefined)
    end()
  })
})

test('respects record_content', (t, end) => {
  const { agent } = t.nr
  const req = {
    input: 'This is my test input',
    model: 'gpt-3.5-turbo-0613'
  }

  function cb(model, content) {
    return 65
  }

  const api = helper.getAgentApi()
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, () => {
    const segment = api.shim.getActiveSegment()
    const embeddingEvent = new LlmEmbedding({
      agent,
      segment,
      request: req,
      response: res
    })
    assert.equal(embeddingEvent['response.usage.total_tokens'], 65)
    end()
  })
})
