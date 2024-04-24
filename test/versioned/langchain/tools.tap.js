/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeModules, removeMatchedModules } = require('../../lib/cache-buster')
// load the assertSegments assertion
require('../../lib/metrics_helper')
const { version: pkgVersion } = require('@langchain/core/package.json')
const config = {
  ai_monitoring: {
    enabled: true
  }
}
const baseUrl = 'http://httpbin.org'
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

tap.test('Langchain instrumentation - tools', (t) => {
  t.beforeEach((t) => {
    t.context.agent = helper.instrumentMockedAgent(config)
    const TestTool = require('./helpers/custom-tool')
    const tool = new TestTool({
      baseUrl
    })
    t.context.tool = tool
    t.context.input = 'langchain'
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
    // bust the require-cache so it can re-instrument
    removeModules(['@langchain/core'])
    removeMatchedModules(/helpers\/custom-tool\.js$/)
  })

  t.test('should create span on successful tools create', (t) => {
    const { agent, tool, input } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const result = await tool.call(input)
      t.ok(result)
      t.assertSegments(tx.trace.root, ['Llm/tool/Langchain/node-agent-test-tool'], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('should increment tracking metric for each tool event', (t) => {
    const { tool, agent, input } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await tool.call(input)

      const metrics = agent.metrics.getOrCreateMetric(
        `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
      )
      t.equal(metrics.callCount > 0, true)

      tx.end()
      t.end()
    })
  })

  t.test('should create LlmTool event for every tool.call', (t) => {
    const { agent, tool, input } = t.context
    helper.runInTransaction(agent, async (tx) => {
      tool.metadata = { key: 'instance-value', hello: 'world' }
      tool.tags = ['tag1', 'tag2']
      await tool.call(input, { metadata: { key: 'value' }, tags: ['tag2', 'tag3'] })
      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 1, 'should create a LlmTool event')
      const [[{ type }, toolEvent]] = events
      t.equal(type, 'LlmTool')
      t.match(toolEvent, {
        'id': /[a-f0-9]{36}/,
        'appName': 'New Relic for Node.js tests',
        'span_id': tx.trace.root.children[0].id,
        'trace_id': tx.traceId,
        'ingest_source': 'Node',
        'vendor': 'langchain',
        'metadata.key': 'value',
        'metadata.hello': 'world',
        'tags': 'tag1,tag2,tag3',
        input,
        'output': tool.fakeData[input],
        'name': tool.name,
        'description': tool.description,
        'duration': tx.trace.root.children[0].getDurationInMillis(),
        'run_id': undefined
      })
      tx.end()
      t.end()
    })
  })

  t.test('should add runId when a callback handler exists', (t) => {
    const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
    let runId
    const cbHandler = BaseCallbackHandler.fromMethods({
      handleToolStart(...args) {
        runId = args?.[2]
      }
    })

    const { agent, tool, input } = t.context
    tool.callbacks = [cbHandler]
    helper.runInTransaction(agent, async (tx) => {
      await tool.call(input)
      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 1, 'should create a LlmTool event')
      const [[, toolEvent]] = events

      t.equal(toolEvent.run_id, runId)
      tx.end()
      t.end()
    })
  })

  t.test('should not create llm tool events when not in a transaction', async (t) => {
    const { tool, agent, input } = t.context
    await tool.call(input)

    const events = agent.customEventAggregator.events.toArray()
    t.equal(events.length, 0, 'should not create llm events')
  })

  t.test('should add llm attribute to transaction', (t) => {
    const { tool, agent, input } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await tool.call(input)

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      t.end()
    })
  })

  t.test('should capture error events', (t) => {
    const { agent, tool } = t.context
    helper.runInTransaction(agent, async (tx) => {
      try {
        await tool.call('bad input')
      } catch (error) {
        t.ok(error)
      }

      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 1)
      const toolEvent = events.find((e) => e[0].type === 'LlmTool')?.[1]
      t.equal(toolEvent.error, true)

      const exceptions = tx.exceptions
      t.equal(exceptions.length, 1)
      const str = Object.prototype.toString.call(exceptions[0].customAttributes)
      t.equal(str, '[object LlmErrorMessage]')
      t.equal(exceptions[0].customAttributes.tool_id, toolEvent.id)

      tx.end()
      t.end()
    })
  })

  t.end()
})
