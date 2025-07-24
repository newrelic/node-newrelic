/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { once } = require('node:events')

const helper = require('../../../lib/agent_helper')
const mockLogger = require('../../mocks/logger')
const { setupOtel } = require('../../../../lib/otel/setup')
const otel = require('@opentelemetry/api')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const loggerMock = mockLogger()
  ctx.nr = {
    agent,
    loggerMock
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should attributeValueLengthLimit accordingly', (t) => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = true
  agent.config.opentelemetry_bridge.traces.enabled = true
  setupOtel(agent, loggerMock)
  const tracer = otel.trace.getTracer('test')
  assert.equal(tracer._spanLimits.attributeValueLengthLimit, 4095)
})

test('should create supportability metric on successful setup of opentelemetry bridge', (t) => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = true
  setupOtel(agent, loggerMock)
  const setupMetric = agent.metrics.getMetric('Supportability/Nodejs/OpenTelemetryBridge/Setup')
  assert.equal(setupMetric.callCount, 1)
})

test('should not create provider when `opentelemetry_bridge` is false', (t) => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = false
  const provider = setupOtel(agent, loggerMock)
  assert.equal(provider, null)
  assert.equal(loggerMock.warn.args[0][0], '`opentelemetry_bridge` is not enabled, skipping setup of opentelemetry-bridge')
})

test('should not create provider when `opentelemetry.bridge.enabled` is false', (t) => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = false
  const provider = setupOtel(agent, loggerMock)
  assert.equal(provider, null)
  assert.equal(loggerMock.warn.args[0][0], '`opentelemetry_bridge` is not enabled, skipping setup of opentelemetry-bridge')
})

test('should assign span key to agent', (t) => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = true
  agent.config.opentelemetry_bridge.traces.enabled = true
  setupOtel(agent, loggerMock)
  assert.ok(agent.otelSpanKey)
})

test('should log message if traces is not enabled', async t => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = true
  agent.config.opentelemetry_bridge.traces.enabled = false
  setupOtel(agent, loggerMock)

  assert.equal(loggerMock.debug.args[0][0], ['`opentelemetry_bridge.traces` is not enabled, skipping'])
})

test('should log message if logs is not enabled', async t => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = true
  agent.config.opentelemetry_bridge.traces.enabled = true
  agent.config.opentelemetry_bridge.metrics.enabled = true
  agent.config.opentelemetry_bridge.logs.enabled = false
  setupOtel(agent, loggerMock)

  assert.equal(loggerMock.debug.args[0][0], '`opentelemetry_bridge.logs` is not enabled, skipping')
})

test('should log message if metrics is not enabled', async t => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = true
  agent.config.opentelemetry_bridge.traces.enabled = true
  setupOtel(agent, loggerMock)

  assert.equal(loggerMock.debug.args[0][0], '`opentelemetry_bridge.metrics` is not enabled, skipping')
})

test('should bootstrap metrics', async t => {
  const { agent, loggerMock } = t.nr
  agent.config.opentelemetry_bridge.enabled = true
  agent.config.opentelemetry_bridge.traces.enabled = true
  agent.config.opentelemetry_bridge.metrics.enabled = true
  setupOtel(agent, loggerMock)

  assert.equal(1, agent.listenerCount('started'))
  process.nextTick(() => agent.emit('started'))
  await once(agent, 'started')
  assert.equal(0, agent.listenerCount('started'))
})
