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
    enabled: true,
    streaming: {
      enabled: true
    }
  }
}

/**
 * Creates a test agent that extends BaseAgent and yields controlled events.
 * This avoids needing a real LLM backend.
 *
 * @param {object} BaseAgent The BaseAgent class from @google/adk
 * @param {object} params Test parameters
 * @param {string} params.name Agent name
 * @param {string} [params.description] Agent description
 * @param {Array} [params.events] Events to yield from runAsyncImpl
 * @param {Error} [params.error] Error to throw from runAsyncImpl
 * @returns {BaseAgent} A test agent instance
 */
function createTestAgent(BaseAgent, { name, description, events = [], error } = {}) {
  class TestAgent extends BaseAgent {
    async * runAsyncImpl() {
      if (error) {
        throw error
      }
      for (const event of events) {
        yield event
      }
    }
  }
  return new TestAgent({ name: name || 'test_agent', description })
}

/**
 * Helper to fully consume an async generator.
 *
 * @param {AsyncGenerator} generator The async generator to consume
 * @returns {Array} All yielded values
 */
async function consumeGenerator(generator) {
  const results = []
  for await (const event of generator) {
    results.push(event)
  }
  return results
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { BaseAgent } = require('@google/adk')
  ctx.nr.BaseAgent = BaseAgent

  ctx.nr.adkVersion = helper.readPackageVersion(__dirname, '@google/adk')
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['@google/adk'])
})

test('should log tracking metrics', function (t, end) {
  t.plan(5)
  const { agent, BaseAgent, adkVersion } = t.nr
  const { assertPackageMetrics } = require('../../lib/custom-assertions')

  const testAgent = createTestAgent(BaseAgent, { name: 'metrics_agent' })

  helper.runInTransaction(agent, async () => {
    await consumeGenerator(testAgent.runAsync({}))
    assertPackageMetrics({
      agent,
      pkg: '@google/adk',
      version: adkVersion,
      subscriberType: true
    }, { assert: t.assert })
    end()
  })
})

test('should create span on successful BaseAgent.runAsync', async (t) => {
  t.plan(2)
  const { agent, BaseAgent } = t.nr
  const assert = t.assert

  const testAgent = createTestAgent(BaseAgent, {
    name: 'span_agent',
    events: [{ id: 'evt-1', author: 'span_agent', content: { parts: [{ text: 'hello' }] } }]
  })

  await helper.runInTransaction(agent, async (tx) => {
    const results = await consumeGenerator(testAgent.runAsync({}))
    assert.equal(results.length, 1)
    assertSegments(tx.trace, tx.trace.root, ['Llm/agent/GoogleADK/runAsync/span_agent'], {
      exact: false
    }, { assert })

    tx.end()
  })
})

test('should create LlmAgent event for BaseAgent.runAsync', async (t) => {
  t.plan(8)
  const { agent, BaseAgent } = t.nr
  const assert = t.assert

  const testAgent = createTestAgent(BaseAgent, {
    name: 'event_agent',
    events: [{ id: 'evt-1', author: 'event_agent', content: { parts: [{ text: 'response' }] } }]
  })

  await helper.runInTransaction(agent, async (tx) => {
    await consumeGenerator(testAgent.runAsync({}))

    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.ok(agentEvents.length > 0, 'should have LlmAgent events')

    const [[{ type }, agentEvent]] = agentEvents
    assert.equal(type, 'LlmAgent')
    const [segment] = tx.trace.getChildren(tx.trace.root.id)

    match(agentEvent, {
      id: /[a-f0-9]{32}/,
      name: 'event_agent',
      span_id: segment.id,
      trace_id: tx.traceId,
      ingest_source: 'Node',
      vendor: 'google_adk'
    }, { assert })

    tx.end()
  })
})

test('should record LLM custom events with attributes', async (t) => {
  t.plan(2)
  const { agent, BaseAgent } = t.nr
  const assert = t.assert
  const api = helper.getAgentApi()

  const testAgent = createTestAgent(BaseAgent, {
    name: 'custom_attrs_agent',
    events: [{ id: 'evt-1', author: 'custom_attrs_agent' }]
  })

  await helper.runInTransaction(agent, async (tx) => {
    await api.withLlmCustomAttributes({ 'llm.foo': 'bar' }, async () => {
      await consumeGenerator(testAgent.runAsync({}))
    })

    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.ok(agentEvents.length > 0)

    const [[, agentEvent]] = agentEvents
    assert.equal(agentEvent?.['llm.foo'], 'bar')

    tx.end()
  })
})

test('should add llm attribute to transaction', async (t) => {
  t.plan(1)
  const { agent, BaseAgent } = t.nr
  const assert = t.assert

  const testAgent = createTestAgent(BaseAgent, {
    name: 'tx_attr_agent',
    events: [{ id: 'evt-1', author: 'tx_attr_agent' }]
  })

  await helper.runInTransaction(agent, async (tx) => {
    await consumeGenerator(testAgent.runAsync({}))

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
  })
})

test('should add subcomponent attribute to span', async (t) => {
  t.plan(1)
  const { agent, BaseAgent } = t.nr
  const assert = t.assert

  const testAgent = createTestAgent(BaseAgent, {
    name: 'subcomp_agent',
    events: [{ id: 'evt-1', author: 'subcomp_agent' }]
  })

  await helper.runInTransaction(agent, async (tx) => {
    await consumeGenerator(testAgent.runAsync({}))

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const attribute = segment?.attributes?.attributes?.subcomponent
    assert.equal(attribute?.value, '{"type": "APM-AI_AGENT", "name": "subcomp_agent"}')

    tx.end()
  })
})

test('should record error LlmAgent event when generator throws', async (t) => {
  t.plan(7)
  const { agent, BaseAgent } = t.nr
  const assert = t.assert

  const testAgent = createTestAgent(BaseAgent, {
    name: 'error_agent',
    error: new Error('agent failure')
  })

  await helper.runInTransaction(agent, async (tx) => {
    await assert.rejects(
      () => consumeGenerator(testAgent.runAsync({})),
      { message: 'agent failure' }
    )

    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.ok(agentEvents.length > 0, 'should have LlmAgent events')

    const [[{ type }, agentEvent]] = agentEvents
    assert.equal(type, 'LlmAgent')
    assert.equal(agentEvent.error, true)

    const exceptions = tx.exceptions
    assert.equal(exceptions.length, 1, 'should have one exception')
    const [exception] = exceptions
    const str = Object.prototype.toString.call(exception.customAttributes)
    assert.equal(str, '[object LlmErrorMessage]', 'should be a LlmErrorMessage')
    assert.equal(exception.customAttributes.agent_id, agentEvent.id, 'agent_id should match LlmAgent event id')

    tx.end()
  })
})

test('should not create llm events when not in a transaction', async (t) => {
  const { agent, BaseAgent } = t.nr
  const assert = t.assert

  const testAgent = createTestAgent(BaseAgent, {
    name: 'no_tx_agent',
    events: [{ id: 'evt-1', author: 'no_tx_agent' }]
  })

  await consumeGenerator(testAgent.runAsync({}))

  const events = agent.customEventAggregator.events.toArray()
  const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
  assert.equal(agentEvents.length, 0, 'should not create LlmAgent events')
})

test('should not create segment or events when ai_monitoring.enabled is false', async (t) => {
  t.plan(2)
  const { agent, BaseAgent } = t.nr
  const assert = t.assert

  agent.config.ai_monitoring.enabled = false

  const testAgent = createTestAgent(BaseAgent, {
    name: 'disabled_agent',
    events: [{ id: 'evt-1', author: 'disabled_agent' }]
  })

  await helper.runInTransaction(agent, async (tx) => {
    await consumeGenerator(testAgent.runAsync({}))

    const segments = tx.trace.getChildren(tx.trace.root.id)
    const adkSegments = segments.filter((s) => s.name.includes('Llm/agent/GoogleADK'))
    assert.equal(adkSegments.length, 0, 'should not create GoogleADK segments')

    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.equal(agentEvents.length, 0, 'should not create LlmAgent events')

    tx.end()
  })
})
