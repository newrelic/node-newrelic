/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const recordSupportabilityMetric = require('#agentlib/subscribers/record-supportability-metric.js')

const PREFIX = 'Supportability/Features/Instrumentation/SubscriberUsed/test-package'

test.beforeEach((ctx) => {
  ctx.nr = { agent: helper.loadMockedAgent() }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

/**
 * Returns the recorded SubscriberUsed metric names.
 *
 * @param {object} agent The agent instance.
 * @returns {string[]} The metric names, sorted.
 */
function recorded(agent) {
  return Object.keys(agent.metrics._metrics.unscoped)
    .filter((name) => name.startsWith(PREFIX))
    .sort()
}

test('records the package and its major', (t) => {
  const { agent } = t.nr
  recordSupportabilityMetric({ agent, moduleName: 'test-package', moduleVersion: '7.18.2' })
  t.assert.deepStrictEqual(recorded(agent), [PREFIX, `${PREFIX}/7`])
})

test('records 0 as a major', (t) => {
  const { agent } = t.nr
  recordSupportabilityMetric({ agent, moduleName: 'test-package', moduleVersion: '0.10.4' })
  t.assert.deepStrictEqual(recorded(agent), [PREFIX, `${PREFIX}/0`])
})

test('does not fall back to the Node.js major when the version is unknown', (t) => {
  const { agent } = t.nr
  recordSupportabilityMetric({ agent, moduleName: 'test-package', moduleVersion: 'unknown' })
  recordSupportabilityMetric({ agent, moduleName: 'test-package' })
  t.assert.deepStrictEqual(recorded(agent), [PREFIX])
})

test('records only the package when the version is invalid', (t) => {
  const { agent } = t.nr
  recordSupportabilityMetric({ agent, moduleName: 'test-package', moduleVersion: 'not-a-version' })
  t.assert.deepStrictEqual(recorded(agent), [PREFIX])
})

test('counts each metric once', (t) => {
  const { agent } = t.nr
  recordSupportabilityMetric({ agent, moduleName: 'test-package', moduleVersion: '1.0.0' })
  recordSupportabilityMetric({ agent, moduleName: 'test-package', moduleVersion: '1.2.0' })
  const metrics = agent.metrics._metrics.unscoped
  t.assert.equal(metrics[PREFIX].callCount, 1)
  t.assert.equal(metrics[`${PREFIX}/1`].callCount, 1)
})
