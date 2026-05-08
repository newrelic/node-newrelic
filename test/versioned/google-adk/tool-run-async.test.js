/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, match } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

const config = {
  ai_monitoring: {
    enabled: true
  }
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { FunctionTool } = require('@google/adk')
  ctx.nr.FunctionTool = FunctionTool

  ctx.nr.adkVersion = helper.readPackageVersion(__dirname, '@google/adk')
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['@google/adk'])
})

test('should create LlmTool event for FunctionTool.runAsync', async (t) => {
  t.plan(11)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  const tool = new FunctionTool({
    name: 'get_weather',
    description: 'Gets the weather for a location',
    execute: async () => {
      return { temperature: '72F', unit: 'fahrenheit' }
    }
  })

  await helper.runInTransaction(agent, async (tx) => {
    const result = await tool.runAsync({
      args: { location: 'San Francisco' },
      toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
    })

    assert.deepStrictEqual(result, { temperature: '72F', unit: 'fahrenheit' })

    const events = agent.customEventAggregator.events.toArray()
    const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
    assert.equal(toolEvents.length, 1, 'should have exactly 1 LlmTool event')

    const [[{ type }, toolEvent]] = toolEvents
    assert.equal(type, 'LlmTool')

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    match(toolEvent, {
      id: /[a-f0-9]{32}/,
      span_id: segment.id,
      trace_id: tx.traceId,
      ingest_source: 'Node',
      vendor: 'google_adk',
      name: 'get_weather',
      input: '{"location":"San Francisco"}',
      output: '{"temperature":"72F","unit":"fahrenheit"}'
    }, { assert })

    tx.end()
  })
})

test('should create span with APM-AI_TOOL subcomponent', async (t) => {
  t.plan(2)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  const tool = new FunctionTool({
    name: 'search_docs',
    description: 'Searches documents',
    execute: async () => { return { results: [] } }
  })

  await helper.runInTransaction(agent, async (tx) => {
    await tool.runAsync({
      args: { query: 'test' },
      toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
    })

    assertSegments(tx.trace, tx.trace.root, ['Llm/tool/GoogleADK/runAsync/search_docs'], {
      exact: false
    }, { assert })

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const attribute = segment?.attributes?.attributes?.subcomponent
    assert.equal(attribute?.value, '{"type": "APM-AI_TOOL", "name": "search_docs"}')

    tx.end()
  })
})

test('should add llm attribute to transaction', async (t) => {
  t.plan(1)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  const tool = new FunctionTool({
    name: 'test_tool',
    description: 'A test tool',
    execute: async () => 'done'
  })

  await helper.runInTransaction(agent, async (tx) => {
    await tool.runAsync({
      args: {},
      toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
    })

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
  })
})

test('should not create events when ai_monitoring.enabled is false', async (t) => {
  t.plan(1)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  agent.config.ai_monitoring.enabled = false

  const tool = new FunctionTool({
    name: 'disabled_tool',
    description: 'A disabled tool',
    execute: async () => 'done'
  })

  await helper.runInTransaction(agent, async (tx) => {
    await tool.runAsync({
      args: {},
      toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
    })

    const events = agent.customEventAggregator.events.toArray()
    const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
    assert.equal(toolEvents.length, 0, 'should not create LlmTool events')

    tx.end()
  })
})

test('should not create events when not in a transaction', async (t) => {
  t.plan(1)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  const tool = new FunctionTool({
    name: 'no_tx_tool',
    description: 'A tool with no transaction',
    execute: async () => 'done'
  })

  await tool.runAsync({
    args: {},
    toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
  })

  const events = agent.customEventAggregator.events.toArray()
  const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
  assert.equal(toolEvents.length, 0, 'should not create LlmTool events')
})

test('should record error LlmTool event when execute throws', async (t) => {
  t.plan(7)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  const tool = new FunctionTool({
    name: 'error_tool',
    description: 'A tool that throws',
    execute: async () => { throw new Error('tool failure') }
  })

  await helper.runInTransaction(agent, async (tx) => {
    await assert.rejects(
      () => tool.runAsync({
        args: {},
        toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
      }),
      { message: "Error in tool 'error_tool': tool failure" }
    )

    const events = agent.customEventAggregator.events.toArray()
    const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
    assert.ok(toolEvents.length > 0, 'should have LlmTool events')

    const [[{ type }, toolEvent]] = toolEvents
    assert.equal(type, 'LlmTool')
    assert.equal(toolEvent.error, true)

    const exceptions = tx.exceptions
    assert.equal(exceptions.length, 1, 'should have one exception')
    const [exception] = exceptions
    const str = Object.prototype.toString.call(exception.customAttributes)
    assert.equal(str, '[object LlmErrorMessage]', 'should be a LlmErrorMessage')
    assert.equal(exception.customAttributes.tool_id, toolEvent.id, 'tool_id should match LlmTool event id')

    tx.end()
  })
})

test('should record LlmTool event with undefined input when args cannot be stringified', async (t) => {
  t.plan(3)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  const tool = new FunctionTool({
    name: 'circular_tool',
    description: 'A tool with circular args',
    execute: async () => 'done'
  })

  const circular = {}
  circular.self = circular

  await helper.runInTransaction(agent, async (tx) => {
    await tool.runAsync({
      args: circular,
      toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
    })

    const events = agent.customEventAggregator.events.toArray()
    const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
    assert.equal(toolEvents.length, 1, 'should still record LlmTool event')

    const [[{ type }, toolEvent]] = toolEvents
    assert.equal(type, 'LlmTool')
    assert.equal(toolEvent.input, undefined, 'input should be undefined when stringify fails')

    tx.end()
  })
})

test('should record LlmTool event with undefined output when result cannot be stringified', async (t) => {
  t.plan(3)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert

  const circular = {}
  circular.self = circular

  const tool = new FunctionTool({
    name: 'circular_output_tool',
    description: 'A tool with circular output',
    execute: async () => circular
  })

  await helper.runInTransaction(agent, async (tx) => {
    await tool.runAsync({
      args: {},
      toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
    })

    const events = agent.customEventAggregator.events.toArray()
    const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
    assert.equal(toolEvents.length, 1, 'should still record LlmTool event')

    const [[{ type }, toolEvent]] = toolEvents
    assert.equal(type, 'LlmTool')
    assert.equal(toolEvent.output, undefined, 'output should be undefined when stringify fails')

    tx.end()
  })
})

test('should record LLM custom attributes on tool events', async (t) => {
  t.plan(2)
  const { agent, FunctionTool } = t.nr
  const assert = t.assert
  const api = helper.getAgentApi()

  const tool = new FunctionTool({
    name: 'attrs_tool',
    description: 'A tool for custom attrs test',
    execute: async () => 'result'
  })

  await helper.runInTransaction(agent, async (tx) => {
    await api.withLlmCustomAttributes({ 'llm.foo': 'bar' }, async () => {
      await tool.runAsync({
        args: {},
        toolContext: { actions: {}, state: { toRecord: () => { return {} } } }
      })
    })

    const events = agent.customEventAggregator.events.toArray()
    const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
    assert.ok(toolEvents.length > 0)

    const [[, toolEvent]] = toolEvents
    assert.equal(toolEvent?.['llm.foo'], 'bar')

    tx.end()
  })
})
