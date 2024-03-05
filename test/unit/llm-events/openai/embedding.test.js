/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmEmbedding = require('../../../../lib/llm-events/openai/embedding')
const helper = require('../../../lib/agent_helper')
const { res, getExpectedResult } = require('./common')

tap.test('LlmEmbedding', (t) => {
  t.autoend()

  let agent
  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should properly create a LlmEmbedding event', (t) => {
    const req = {
      input: 'This is my test input',
      model: 'gpt-3.5-turbo-0613'
    }

    const api = helper.getAgentApi()
    helper.runInTransaction(agent, (tx) => {
      api.startSegment('fakeSegment', false, () => {
        const segment = api.shim.getActiveSegment()
        segment.end()
        const embeddingEvent = new LlmEmbedding({ agent, segment, request: req, response: res })
        const expected = getExpectedResult(tx, embeddingEvent, 'embedding')
        t.same(embeddingEvent, expected)
        t.end()
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
    t.test(`should properly serialize input when it is a ${type}`, (t) => {
      const embeddingEvent = new LlmEmbedding({
        agent,
        segment: null,
        request: { input: value },
        response: {}
      })
      t.equal(embeddingEvent.input, expected)
      t.end()
    })
  })

  t.test('should set error to true', (t) => {
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
        t.equal(true, embeddingEvent.error)
        t.end()
      })
    })
  })

  t.test('respects record_content', (t) => {
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
      t.equal(embeddingEvent.input, undefined)
      t.end()
    })
  })

  t.test('should calculate token count from tokenCountCallback', (t) => {
    const req = {
      input: 'This is my test input',
      model: 'gpt-3.5-turbo-0613'
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
      t.equal(embeddingEvent.token_count, 21)
      t.end()
    })
  })

  t.test('should not set token count when not present in usage nor tokenCountCallback', (t) => {
    const req = {
      input: 'This is my test input',
      model: 'gpt-3.5-turbo-0613'
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
      t.equal(embeddingEvent.token_count, undefined)
      t.end()
    })
  })
})
