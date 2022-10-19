/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper.js')
const API = require('../../../api.js')
const { SUPPORTABILITY, LOGGING } = require('../../../lib/metrics/names')
const API_METRIC = SUPPORTABILITY.API + '/recordLogEvent'

tap.test('Agent API - recordCustomEvent', (t) => {
  t.autoend()

  let agent = null
  let api = null
  const message = 'just logging a log in the logger'

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    api = null
  })

  t.test('can handle a singular log message', (t) => {
    const now = Date.now()
    t.doesNotThrow(() => {
      api.recordLogEvent({ message })
    }, 'does not throw when logging a single message')

    const logMessage = popTopLogMessage(agent)
    t.ok(logMessage, 'we have a log message')
    t.equal(logMessage.message, message, 'it has the right log message')
    t.equal(logMessage.level, 'UNKNOWN', 'it has UNKNOWN severity')
    t.ok(logMessage.timestamp >= now, 'its timestamp is current')
    t.ok(logMessage.hostname, 'a hostname was set')
    t.notOk(logMessage['trace.id'], 'it does not have a trace id')
    t.notOk(logMessage['span.id'], 'it does not have a span id')

    const lineMetric = agent.metrics.getMetric(LOGGING.LINES)
    t.ok(lineMetric, 'line logging metric exists')
    t.equal(lineMetric.callCount, 1, 'ensure a single log line was counted')

    const unknownLevelMetric = agent.metrics.getMetric(LOGGING.LEVELS.UNKNOWN)
    t.ok(unknownLevelMetric, 'unknown level logging metric exists')
    t.equal(unknownLevelMetric.callCount, 1, 'ensure a single log line was counted')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    t.ok(apiMetric, 'API logging metric exists')
    t.equal(apiMetric.callCount, 1, 'ensure one API call was counted')

    t.end()
  })

  t.test('adds the proper linking data in a transaction', (t) => {
    const now = Date.now()

    helper.runInTransaction(agent, 'logging-api-test', (tx) => {
      api.recordLogEvent({ message, level: 'info' })
      tx.end()
    })
    const logMessage = popTopLogMessage(agent)

    t.ok(logMessage, 'we have a log message')
    t.equal(logMessage.message, message, 'it has the right log message')
    t.equal(logMessage.level, 'info', 'it has `info` severity')
    t.ok(logMessage.timestamp >= now, 'its timestamp is current')
    t.ok(logMessage.hostname, 'a hostname was set')
    t.ok(logMessage['trace.id'], 'it has a trace id')
    t.ok(logMessage['span.id'], 'it has a spand id')

    const lineMetric = agent.metrics.getMetric(LOGGING.LINES)
    t.ok(lineMetric, 'line logging metric exists')
    t.equal(lineMetric.callCount, 1, 'ensure a single log line was counted')

    const infoLevelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
    t.ok(infoLevelMetric, 'info level logging metric exists')
    t.equal(infoLevelMetric.callCount, 1, 'ensure a single log line was counted')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    t.ok(apiMetric, 'API logging metric exists')
    t.equal(apiMetric.callCount, 1, 'ensure one API call was counted')

    t.end()
  })

  t.test('does not collect logs when high security mode is on', (t) => {
    // We need to go through all of the config logic, as HSM disables
    // log forwarding as one of its configs, can't just directly set
    // the HSM config after the agent has been created.
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent({ high_security: true })
    api = new API(agent)

    api.recordLogEvent({ message })

    const logs = getLogMessages(agent)
    t.equal(logs.length, 0, 'no log messages in queue')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    t.ok(apiMetric, 'API logging metric exists anyway')
    t.equal(apiMetric.callCount, 1, 'ensure one API call was counted anyway')

    t.end()
  })

  t.test('does not collect logs when log forwarding is disabled in the config', (t) => {
    agent.config.application_logging.forwarding.enabled = false
    api.recordLogEvent({ message })

    const logs = getLogMessages(agent)
    t.equal(logs.length, 0, 'no log messages in queue')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    t.ok(apiMetric, 'API logging metric exists anyway')
    t.equal(apiMetric.callCount, 1, 'ensure one API call was counted anyway')

    t.end()
  })

  t.test('it does not collect logs if the user sends a malformed message', (t) => {
    t.doesNotThrow(() => {
      api.recordLogEvent(message)
    }, 'no erroring out if passing in a string instead of an object')

    t.doesNotThrow(() => {
      api.recordLogEvent({ msg: message })
    }, 'no erroring out if passing in an object missing a "message" attribute')

    const logs = getLogMessages(agent)
    t.equal(logs.length, 0, 'no log messages in queue')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    t.ok(apiMetric, 'API logging metric exists anyway')
    t.equal(apiMetric.callCount, 2, 'ensure two API calls were counted anyway')

    t.end()
  })

  t.test('log line metrics are not collected if the setting is disabled', (t) => {
    agent.config.application_logging.metrics.enabled = false
    api.recordLogEvent({ message })

    const logMessage = popTopLogMessage(agent)
    t.ok(logMessage, 'we have a log message')

    const lineMetric = agent.metrics.getMetric(LOGGING.LINES)
    t.notOk(lineMetric, 'line logging metric does not exist')

    const unknownLevelMetric = agent.metrics.getMetric(LOGGING.LEVELS.UNKNOWN)
    t.notOk(unknownLevelMetric, 'unknown level logging metric does not exist')

    const apiMetric = agent.metrics.getMetric(API_METRIC)
    t.ok(apiMetric, 'but API logging metric does exist')
    t.equal(apiMetric.callCount, 1, 'and one API call was counted anyway')
    t.end()
  })
})

function popTopLogMessage(agent) {
  return getLogMessages(agent).pop()
}

function getLogMessages(agent) {
  return agent.logs.events.toArray()
}
