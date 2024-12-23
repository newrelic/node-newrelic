/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules, removeMatchedModules } = require('../../lib/cache-buster')
const { assertSegments, match } = require('../../lib/custom-assertions')
const { version: pkgVersion } = require('@langchain/core/package.json')
const helper = require('../../lib/agent_helper')

const baseUrl = 'http://httpbin.org'
const config = {
  ai_monitoring: {
    enabled: true
  }
}
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  const TestTool = require('./helpers/custom-tool')
  const tool = new TestTool({
    baseUrl
  })
  ctx.nr.tool = tool
  ctx.nr.input = 'langchain'
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core'])
  removeMatchedModules(/helpers\/custom-tool\.js$/)
})

test('should create span on successful tools create', (t, end) => {
  const { agent, tool, input } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const result = await tool.call(input)
    assert.ok(result)
    assertSegments(tx.trace.root, ['Llm/tool/Langchain/node-agent-test-tool'], { exact: false })
    tx.end()
    end()
  })
})

test('should increment tracking metric for each tool event', (t, end) => {
  const { tool, agent, input } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await tool.call(input)

    const metrics = agent.metrics.getOrCreateMetric(
      `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
    )
    assert.equal(metrics.callCount > 0, true)

    tx.end()
    end()
  })
})

test('should create LlmTool event for every tool.call', (t, end) => {
  const { agent, tool, input } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    tool.metadata = { key: 'instance-value', hello: 'world' }
    tool.tags = ['tag1', 'tag2']
    await tool.call(input, { metadata: { key: 'value' }, tags: ['tag2', 'tag3'] })
    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 1, 'should create a LlmTool event')
    const [[{ type }, toolEvent]] = events
    assert.equal(type, 'LlmTool')
    match(toolEvent, {
      id: /[a-f0-9]{36}/,
      appName: 'New Relic for Node.js tests',
      span_id: tx.trace.root.children[0].id,
      trace_id: tx.traceId,
      ingest_source: 'Node',
      vendor: 'langchain',
      'metadata.key': 'value',
      'metadata.hello': 'world',
      tags: 'tag1,tag2,tag3',
      input,
      output: tool.fakeData[input],
      name: tool.name,
      description: tool.description,
      duration: tx.trace.root.children[0].getDurationInMillis(),
      run_id: undefined
    })
    tx.end()
    end()
  })
})

test('should add runId when a callback handler exists', (t, end) => {
  const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
  let runId
  const cbHandler = BaseCallbackHandler.fromMethods({
    handleToolStart(...args) {
      runId = args?.[2]
    }
  })

  const { agent, tool, input } = t.nr
  tool.callbacks = [cbHandler]
  helper.runInTransaction(agent, async (tx) => {
    await tool.call(input)
    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 1, 'should create a LlmTool event')
    const [[, toolEvent]] = events

    assert.equal(toolEvent.run_id, runId)
    tx.end()
    end()
  })
})

test('should not create llm tool events when not in a transaction', async (t) => {
  const { tool, agent, input } = t.nr
  await tool.call(input)

  const events = agent.customEventAggregator.events.toArray()
  assert.equal(events.length, 0, 'should not create llm events')
})

test('should add llm attribute to transaction', (t, end) => {
  const { tool, agent, input } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await tool.call(input)

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
    end()
  })
})

test('should capture error events', (t, end) => {
  const { agent, tool } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    try {
      await tool.call('bad input')
    } catch (error) {
      assert.ok(error)
    }

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 1)
    const toolEvent = events.find((e) => e[0].type === 'LlmTool')?.[1]
    assert.equal(toolEvent.error, true)

    const exceptions = tx.exceptions
    assert.equal(exceptions.length, 1)
    const str = Object.prototype.toString.call(exceptions[0].customAttributes)
    assert.equal(str, '[object LlmErrorMessage]')
    assert.equal(exceptions[0].customAttributes.tool_id, toolEvent.id)

    tx.end()
    end()
  })
})
