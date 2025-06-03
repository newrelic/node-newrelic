/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmEmbedding = require('#agentlib/llm-events/google-genai/embedding.js')
const helper = require('#testlib/agent_helper.js')
const { res, getExpectedResult } = require('./common')

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
    contents: 'This is my test input',
    model: 'gemini-2.0-flash'
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

const serializeTestCases = [
  { type: 'string', value: 'test contents', expected: 'test contents' },
  {
    type: 'array of strings',
    value: ['test contents', 'test input2'],
    expected: 'test contents,test input2'
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
]
for (const testCase of serializeTestCases) {
  test(`should properly serialize contents when it is a ${testCase.type}`, (t, end) => {
    const { agent } = t.nr
    const embeddingEvent = new LlmEmbedding({
      agent,
      segment: null,
      transaction: null,
      request: { contents: testCase.value },
      response: {}
    })
    assert.equal(embeddingEvent.input, testCase.expected)
    end()
  })
}

test('should set error to true', (t, end) => {
  const { agent } = t.nr
  const req = {
    contents: 'This is my test input',
    model: 'gemini-2.0-flash'
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
    contents: 'This is my test input',
    model: 'gemini-2.0-flash'
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

test('should calculate token count from tokenCountCallback', (t, end) => {
  const { agent } = t.nr
  const req = {
    contents: 'This is my test input',
    model: 'gemini-2.0-flash'
  }

  const api = helper.getAgentApi()

  function cb(model, content) {
    if (model === req.model) {
      return content.length
    }
  }

  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, () => {
    const segment = api.shim.getActiveSegment()
    delete res.usage
    const embeddingEvent = new LlmEmbedding({
      agent,
      segment,
      request: req,
      response: res
    })
    assert.equal(embeddingEvent.token_count, 21)
    end()
  })
})

test('should not set token count when not present in usage or tokenCountCallback', (t, end) => {
  const { agent } = t.nr
  const req = {
    input: 'This is my test input',
    model: 'gemini-2.0-flash'
  }

  const api = helper.getAgentApi()
  helper.runInTransaction(agent, () => {
    const segment = api.shim.getActiveSegment()
    delete res.usage
    const embeddingEvent = new LlmEmbedding({
      agent,
      segment,
      request: req,
      response: res
    })
    assert.equal(embeddingEvent.token_count, undefined)
    end()
  })
})
