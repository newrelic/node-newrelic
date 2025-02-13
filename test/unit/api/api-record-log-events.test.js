/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper.js')
const API = require('../../../api.js')
const { SUPPORTABILITY, LOGGING } = require('../../../lib/metrics/names')
const API_METRIC = SUPPORTABILITY.API + '/recordLogEvent'
const message = 'just logging a log in the logger'

test('Agent API - recordCustomEvent', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('can handle a singular log message', (t, end) => {
    const { agent, api } = t.nr
    const now = Date.now()
    const error = new Error('testing error')
    api.recordLogEvent({
      message,
      error
    })

    const logMessage = popTopLogMessage(agent)
    assert.ok(logMessage, 'we have a log message')
    assert.equal(logMessage.message, message, 'it has the right log message')
    assert.equal(logMessage.level, 'UNKNOWN', 'it has UNKNOWN severity')
    assert.ok(logMessage.timestamp >= now, 'its timestamp is current')
    assert.ok(logMessage.hostname, 'a hostname was set')
    assert.ok(!logMessage['trace.id'], 'it does not have a trace id')
    assert.ok(!logMessage['span.id'], 'it does not have a span id')
    assert.equal(logMessage['error.message'], 'testing error', 'it has the right error.message')
    assert.equal(
      logMessage['error.stack'].substring(0, 1021),
      error.stack.substring(0, 1021),
      'it has the right error.stack'
    )
    assert.equal(logMessage['error.class'], 'Error', 'it has the right error.class')

    const lineMetric = agent.metrics.getMetric(LOGGING.LINES)
    assert.ok(lineMetric, 'line logging metric exists')
    assert.equal(lineMetric.callCount, 1, 'ensure a single log line was counted')

    const unknownLevelMetric = agent.metrics.getMetric(LOGGING.LEVELS.UNKNOWN)
    assert.ok(unknownLevelMetric, 'unknown level logging metric exists')
    assert.equal(unknownLevelMetric.callCount, 1, 'ensure a single log line was counted')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    assert.ok(apiMetric, 'API logging metric exists')
    assert.equal(apiMetric.callCount, 1, 'ensure one API call was counted')

    end()
  })

  await t.test('adds the proper linking data in a transaction', (t, end) => {
    const { agent, api } = t.nr
    agent.config.entity_guid = 'api-guid'
    const birthday = 365515200000
    const birth = 'a new jordi is here'

    helper.runInTransaction(agent, 'logging-api-test', (tx) => {
      api.recordLogEvent({ message: birth, timestamp: birthday, level: 'info' })
      tx.end()
    })
    const logMessage = popTopLogMessage(agent)

    assert.ok(logMessage, 'we have a log message')
    assert.equal(logMessage.message, birth, 'it has the right log message')
    assert.equal(logMessage.level, 'info', 'it has `info` severity')
    assert.equal(logMessage.timestamp, birthday, 'its timestamp is correct')
    assert.ok(logMessage.hostname, 'a hostname was set')
    assert.ok(logMessage['trace.id'], 'it has a trace id')
    assert.ok(logMessage['span.id'], 'it has a span id')
    assert.ok(logMessage['entity.type'], 'it has an entity type')
    assert.ok(logMessage['entity.name'], 'it has an entity name')
    assert.equal(logMessage['entity.guid'], 'api-guid', 'it has the right entity guid')

    const lineMetric = agent.metrics.getMetric(LOGGING.LINES)
    assert.ok(lineMetric, 'line logging metric exists')
    assert.equal(lineMetric.callCount, 1, 'ensure a single log line was counted')

    const infoLevelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
    assert.ok(infoLevelMetric, 'info level logging metric exists')
    assert.equal(infoLevelMetric.callCount, 1, 'ensure a single log line was counted')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    assert.ok(apiMetric, 'API logging metric exists')
    assert.equal(apiMetric.callCount, 1, 'ensure one API call was counted')

    end()
  })

  await t.test('does not collect logs when log forwarding is disabled in the config', (t, end) => {
    const { agent, api } = t.nr
    agent.config.application_logging.forwarding.enabled = false
    api.recordLogEvent({ message })

    const logs = getLogMessages(agent)
    assert.equal(logs.length, 0, 'no log messages in queue')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    assert.ok(apiMetric, 'API logging metric exists anyway')
    assert.equal(apiMetric.callCount, 1, 'ensure one API call was counted anyway')

    end()
  })

  await t.test('it does not collect logs if the user sends a malformed message', (t, end) => {
    const { agent, api } = t.nr
    assert.doesNotThrow(() => {
      api.recordLogEvent(message)
    }, 'no erroring out if passing in a string instead of an object')

    assert.doesNotThrow(() => {
      api.recordLogEvent({ msg: message })
    }, 'no erroring out if passing in an object missing a "message" attribute')

    const logs = getLogMessages(agent)
    assert.equal(logs.length, 0, 'no log messages in queue')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    assert.ok(apiMetric, 'API logging metric exists anyway')
    assert.equal(apiMetric.callCount, 2, 'ensure two API calls were counted anyway')

    end()
  })

  await t.test('log line metrics are not collected if the setting is disabled', (t, end) => {
    const { agent, api } = t.nr
    agent.config.application_logging.metrics.enabled = false
    api.recordLogEvent({ message })

    const logMessage = popTopLogMessage(agent)
    assert.ok(logMessage, 'we have a log message')

    const lineMetric = agent.metrics.getMetric(LOGGING.LINES)
    assert.ok(!lineMetric, 'line logging metric does not exist')

    const unknownLevelMetric = agent.metrics.getMetric(LOGGING.LEVELS.UNKNOWN)
    assert.ok(!unknownLevelMetric, 'unknown level logging metric does not exist')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    assert.ok(apiMetric, 'but API logging metric does exist')
    assert.equal(apiMetric.callCount, 1, 'and one API call was counted anyway')
    end()
  })

  await t.test('it works with large JSON log messages', (t, end) => {
    const { agent, api } = t.nr
    const json = JSON.stringify({
      message: message.repeat(100),
      nested: {
        prop1: 123,
        prop2: 'a string',
      },
      array: Array.from({ length: 1000 }, (_, i) => 'item number ' + i),
      nonPrimitive: new Date(),
    })
    api.recordLogEvent({ message: json })
    const logEvent = popTopLogMessage(agent)
    assert.equal(logEvent.message, json)
    end()
  })
})

test('does not collect logs when high security mode is on', (_t, end) => {
  // We need to go through all of the config logic, as HSM disables
  // log forwarding as one of its configs, can't just directly set
  // the HSM config after the agent has been created.
  const agent = helper.loadMockedAgent({ high_security: true })
  const api = new API(agent)

  api.recordLogEvent({ message })

  const logs = getLogMessages(agent)
  assert.equal(logs.length, 0, 'no log messages in queue')

  const apiMetric = agent.metrics.getMetric(API_METRIC)
  assert.ok(apiMetric, 'API logging metric exists anyway')
  assert.equal(apiMetric.callCount, 1, 'ensure one API call was counted anyway')
  end()
})

function popTopLogMessage(agent) {
  return getLogMessages(agent).pop()
}

function getLogMessages(agent) {
  return agent.logs.events.toArray()
}
