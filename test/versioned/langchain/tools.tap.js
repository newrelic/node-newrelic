/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
// load the assertSegments assertion
require('../../lib/metrics_helper')
const fs = require('fs')
// have to read and not require because openai does not export the package.json
const { version: pkgVersion } = JSON.parse(
  fs.readFileSync(`${__dirname}/node_modules/@langchain/core/package.json`)
)
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const config = {
  ai_monitoring: {
    enabled: true
  },
  feature_flag: {
    langchain_instrumentation: true
  }
}

tap.test('Langchain instrumentation - tools', (t) => {
  t.autoend()

  t.before(() => {
    t.context.agent = helper.instrumentMockedAgent(config)
    const { WikipediaQueryRun } = require('@langchain/community/tools/wikipedia_query_run')
    t.context.tool = new WikipediaQueryRun({
      topKResults: 3,
      maxDocContentLength: 4000
    })
  })

  t.afterEach(() => {
    t.context.agent.customEventAggregator.clear()
  })

  t.teardown(() => {
    helper.unloadAgent(t.context.agent)
  })

  t.test('should create span on successful tools create', (test) => {
    const { agent, tool } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const result = await tool.call('Langchain')
      test.ok(result)
      test.assertSegments(
        tx.trace.root,
        ['Llm/tool/Langchain/wikipedia-api', [`External/en.wikipedia.org/w/api.php`]],
        { exact: false }
      )
      tx.end()
      test.end()
    })
  })

  t.test('should increment tracking metric for each tool event', (test) => {
    const { tool, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await tool.call('Langchain')

      const metrics = agent.metrics.getOrCreateMetric(
        `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
      )
      test.equal(metrics.callCount > 0, true)

      tx.end()
      test.end()
    })
  })

  t.test('should create LlmTool event for every tool.call', (test) => {
    const { agent, tool } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const input = 'Langchain'
      tool.metadata = { key: 'instance-value', hello: 'world' }
      tool.tags = ['tag1', 'tag2']
      await tool.call(input, { metadata: { key: 'value' }, tags: ['tag2', 'tag3'] })
      const events = agent.customEventAggregator.events.toArray()
      test.equal(events.length, 1, 'should create a LlmTool event')
      const [[{ type }, toolEvent]] = events
      test.equal(type, 'LlmTool')
      test.match(toolEvent, {
        'id': /[a-f0-9]{36}/,
        'appName': 'New Relic for Node.js tests',
        'span_id': tx.trace.root.children[0].id,
        'trace_id': tx.traceId,
        'transaction_id': tx.id,
        'ingest_source': 'Node',
        'vendor': 'langchain',
        'metadata.key': 'value',
        'metadata.hello': 'world',
        'tags': 'tag1,tag2,tag3',
        input,
        'output': /Page: LangChain.*/,
        'name': tool.name,
        'description': tool.description,
        'duration': tx.trace.root.children[0].getDurationInMillis(),
        'run_id': undefined
      })
      tx.end()
      test.end()
    })
  })

  t.test('should add runId when a callback handler exists', (test) => {
    const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
    let runId
    const cbHandler = BaseCallbackHandler.fromMethods({
      handleToolStart(...args) {
        runId = args?.[2]
      }
    })

    const { agent, tool } = t.context
    tool.callbacks = [cbHandler]
    helper.runInTransaction(agent, async (tx) => {
      const input = 'Langchain'
      await tool.call(input)
      const events = agent.customEventAggregator.events.toArray()
      test.equal(events.length, 1, 'should create a LlmTool event')
      const [[, toolEvent]] = events

      test.equal(toolEvent.run_id, runId)
      tx.end()
      test.end()
    })
  })

  t.test('should not create llm tool events when not in a transaction', async (test) => {
    const { tool, agent } = t.context
    await tool.call('Langchain')

    const events = agent.customEventAggregator.events.toArray()
    test.equal(events.length, 0, 'should not create llm events')
  })

  t.test('should add llm attribute to transaction', (test) => {
    const { tool, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await tool.call('Langchain')

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      test.end()
    })
  })
})
