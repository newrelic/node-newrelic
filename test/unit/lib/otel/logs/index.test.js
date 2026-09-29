/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const logsApi = require('@opentelemetry/api-logs')

const helper = require('../../../../lib/agent_helper')
const mockLogger = require('../../../mocks/logger')
const SetupLogs = require('#agentlib/otel/logs/index.js')

const ENABLED_METRIC = 'Supportability/Logging/Nodejs/OpenTelemetryBridge/enabled'
const DISABLED_METRIC = 'Supportability/Logging/Nodejs/OpenTelemetryBridge/disabled'

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = mockLogger()
  ctx.nr = { agent, logger }
})

test.afterEach((ctx) => {
  logsApi.logs.disable()
  helper.unloadAgent(ctx.nr.agent)
  sinon.restore()
})

test('logs notice and creates the disabled metric when application logging is disabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.enabled = false

  const signal = new SetupLogs({ agent, logger })
  assert.ok(signal)

  assert.ok(logger.info.calledWith('application logging disabled, skipping otel logs setup'))
  assert.equal(agent.metrics.getMetric(DISABLED_METRIC).callCount, 1)
  assert.equal(agent.metrics.getMetric(ENABLED_METRIC), undefined)
})

test('does not set the global logger provider when application logging is disabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.enabled = false

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  const otelLogger = logsApi.logs.getLogger('test-lib')
  assert.equal(otelLogger.enabled(), false)
})

test('does not emit otelLogsBootstrapped when application logging is disabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.enabled = false
  const bootstrapped = sinon.spy()
  agent.on('otelLogsBootstrapped', bootstrapped)

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  assert.equal(bootstrapped.callCount, 0)
})

test('creates the enabled metric and sets the global logger provider when application logging is enabled', (t) => {
  const { agent, logger } = t.nr

  const signal = new SetupLogs({ agent, logger })
  assert.ok(signal)

  assert.equal(agent.metrics.getMetric(ENABLED_METRIC).callCount, 1)
  assert.equal(agent.metrics.getMetric(DISABLED_METRIC), undefined)

  const otelLogger = logsApi.logs.getLogger('test-lib')
  assert.equal(otelLogger.enabled(), true)
})

test('emits otelLogsBootstrapped once setup completes', (t) => {
  const { agent, logger } = t.nr
  const bootstrapped = sinon.spy()
  agent.on('otelLogsBootstrapped', bootstrapped)

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  assert.equal(bootstrapped.callCount, 1)
})

test('logger enabled() is false when both metrics and forwarding are disabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.metrics.enabled = false
  agent.config.application_logging.forwarding.enabled = false

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  assert.equal(logsApi.logs.getLogger('test-lib').enabled(), false)
})

test('logger enabled() is true when only metrics is enabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.metrics.enabled = true
  agent.config.application_logging.forwarding.enabled = false

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  assert.equal(logsApi.logs.getLogger('test-lib').enabled(), true)
})

test('logger enabled() is true when only forwarding is enabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.metrics.enabled = false
  agent.config.application_logging.forwarding.enabled = true

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  assert.equal(logsApi.logs.getLogger('test-lib').enabled(), true)
})

test('increments logging line metrics when metrics are enabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.forwarding.enabled = false

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  logsApi.logs.getLogger('test-lib').emit({ body: 'hello', severityNumber: 9 })
  logsApi.logs.getLogger('test-lib').emit({ body: 'oh no', severityNumber: 17 })

  assert.equal(agent.metrics.getMetric('Logging/lines').callCount, 2)
  assert.equal(agent.metrics.getMetric('Logging/lines/INFO').callCount, 1)
  assert.equal(agent.metrics.getMetric('Logging/lines/ERROR').callCount, 1)
})

test('does not increment logging line metrics when metrics are disabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.metrics.enabled = false

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  logsApi.logs.getLogger('test-lib').emit({ body: 'hello', severityNumber: 9 })

  assert.equal(agent.metrics.getMetric('Logging/lines'), undefined)
})

test('forwards log data to agent.logs when forwarding is enabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.metrics.enabled = false
  sinon.stub(agent.logs, 'add')

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })
  const now = Date.now()

  const record = {
    body: 'hello world',
    severityNumber: 9,
    timestamp: now,
    attributes: { foo: 'bar' }
  }
  logsApi.logs.getLogger('test-lib').emit(record)

  assert.equal(agent.logs.add.callCount, 1)
  const logData = agent.logs.add.args[0][0]
  assert.equal(logData.message, 'hello world')
  assert.equal(logData.level, 'info')
  assert.equal(logData.timestamp, now)
  assert.equal(logData.foo, 'bar')
})

test('does not forward log data to agent.logs when forwarding is disabled', (t) => {
  const { agent, logger } = t.nr
  agent.config.application_logging.forwarding.enabled = false
  sinon.stub(agent.logs, 'add')

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  logsApi.logs.getLogger('test-lib').emit({ body: 'hello', severityNumber: 9 })

  assert.equal(agent.logs.add.callCount, 0)
})

test('attaches otel.scope.* and otel.library.* attributes when the logger has scope info', (t) => {
  const { agent, logger } = t.nr
  sinon.stub(agent.logs, 'add')

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  logsApi.logs.getLogger('my-lib', '1.2.3').emit({ body: 'hello', severityNumber: 9 })

  assert.equal(agent.logs.add.callCount, 1)
  const logData = agent.logs.add.args[0][0]
  assert.equal(logData['otel.scope.name'], 'my-lib')
  assert.equal(logData['otel.library.name'], 'my-lib')
  assert.equal(logData['otel.scope.version'], '1.2.3')
  assert.equal(logData['otel.library.version'], '1.2.3')
})

test('does not attach otel.scope.* attributes when the logger has no name or version', (t) => {
  const { agent, logger } = t.nr
  sinon.stub(agent.logs, 'add')

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  logsApi.logs.getLogger().emit({ body: 'hello', severityNumber: 9 })

  assert.equal(agent.logs.add.callCount, 1)
  const logData = agent.logs.add.args[0][0]
  assert.equal('otel.scope.name' in logData, false)
  assert.equal('otel.library.name' in logData, false)
  assert.equal('otel.scope.version' in logData, false)
  assert.equal('otel.library.version' in logData, false)
})

test('record attributes and linking metadata are merged into the forwarded log data', (t) => {
  const { agent, logger } = t.nr
  sinon.stub(agent.logs, 'add')
  sinon.stub(agent, 'getLinkingMetadata').returns({ 'trace.id': 'trace-123', 'span.id': 'span-456' })

  // eslint-disable-next-line no-new
  new SetupLogs({ agent, logger })

  logsApi.logs.getLogger('test-lib').emit({
    body: 'hello',
    severityNumber: 9,
    attributes: { 'custom.attr': 'value' }
  })

  assert.ok(agent.getLinkingMetadata.calledWith(true))
  const logData = agent.logs.add.args[0][0]
  assert.equal(logData['custom.attr'], 'value')
  assert.equal(logData['trace.id'], 'trace-123')
  assert.equal(logData['span.id'], 'span-456')
})

test('teardown disables the global logger provider', (t) => {
  const { agent, logger } = t.nr
  const signal = new SetupLogs({ agent, logger })

  assert.equal(logsApi.logs.getLogger('test-lib').enabled(), true)

  signal.teardown()

  assert.equal(logsApi.logs.getLogger('test-lib').enabled(), false)
})
