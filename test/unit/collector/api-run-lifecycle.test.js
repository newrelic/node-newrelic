/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const nock = require('nock')

const helper = require('../../lib/agent_helper')
const CollectorApi = require('../../../lib/collector/api')

const HOST = 'collector.newrelic.com'
const PORT = 443
const URL = 'https://' + HOST
const RUN_ID = 1337

tap.test('should bail out if disconnected', (t) => {
  const agent = setupMockedAgent()
  const collectorApi = new CollectorApi(agent)

  t.tearDown(() => {
    helper.unloadAgent(agent)
  })

  function tested(error) {
    t.ok(error)
    t.equal(error.message, 'Not connected to collector.')

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should discard HTTP 413 errors', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(413)

  function tested(error, command) {
    t.error(error)
    t.equal(command.retainData, false)

    failure.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should discard HTTP 415 errors', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(415)

  function tested(error, command) {
    t.error(error)
    t.equal(command.retainData, false)

    failure.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should retain after HTTP 500 errors', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(500)

  function tested(error, command) {
    t.error(error)
    t.equal(command.retainData, true)

    failure.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should retain after HTTP 503 errors', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(503)

  function tested(error, command) {
    t.error(error)
    t.equal(command.retainData, true)

    failure.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should indicate a restart and discard data after 401 errors', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(401)

  function tested(error, command) {
    t.error(error)
    t.equal(command.retainData, false)
    t.equal(command.shouldRestartRun(), true)

    failure.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should indicate a restart and discard data after 409 errors', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(409)

  function tested(error, command) {
    t.error(error)
    t.equal(command.retainData, false)
    t.equal(command.shouldRestartRun(), true)

    failure.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should stop the agent on 410 (force disconnect)', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const shutdownEndpoint = nock(URL)
    .post(helper.generateCollectorPath('shutdown', RUN_ID))
    .reply(200, {return_value: null})

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(410)

  function tested(error, command) {
    t.error(error)
    t.equal(command.shouldShutdownRun(), true)

    t.notOk(agent.config.run_id)

    failure.done()
    shutdownEndpoint.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

tap.test('should discard unexpected HTTP errors (501)', (t) => {
  const agent = setupMockedAgent()
  agent.config.run_id = RUN_ID
  const collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.tearDown(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  const failure = nock(URL)
    .post(helper.generateCollectorPath('metric_data', RUN_ID))
    .reply(501)

  function tested(error, command) {
    t.error(error)
    t.equal(command.retainData, false)

    failure.done()

    t.end()
  }

  const method = collectorApi._methods.metrics
  collectorApi._runLifecycle(method, null, tested)
})

function setupMockedAgent() {
  const agent = helper.loadMockedAgent({
    host: HOST,
    port: PORT,
    app_name: ['TEST'],
    ssl: true,
    license_key: 'license key here',
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    },
    browser_monitoring: {},
    transaction_tracer: {}
  })
  agent.reconfigure = function() {}
  agent.setState = function() {}

  return agent
}
