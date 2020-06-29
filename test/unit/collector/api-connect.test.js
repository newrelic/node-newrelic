/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const nock = require('nock')

const helper = require('../../lib/agent_helper')
const CollectorApi = require('../../../lib/collector/api')
const CollectorResponse = require('../../../lib/collector/response')
const securityPolicies = require('../../lib/fixtures').securityPolicies

const HOST = 'collector.newrelic.com'
const PORT = 443
const URL = 'https://' + HOST
const RUN_ID = 1337

const timeout = global.setTimeout

tap.test('requires a callback', (t) => {
  const agent = setupMockedAgent()
  const collectorApi = new CollectorApi(agent)

  t.tearDown(() => {
    helper.unloadAgent(agent)
  })

  t.throws(() => { collectorApi.connect(null) }, 'callback is required')

  t.end()
})

tap.test('receiving 200 response, with valid data', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null
  let connection = null

  const validSsc = {
    agent_run_id: RUN_ID
  }

  t.beforeEach((done) => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    const response = {return_value: validSsc}

    redirection = nock(URL + ':443')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {return_value: {redirect_host: HOST, security_policies: {}}})
    connection = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)

    done()
  })

  t.afterEach((done) => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()

    helper.unloadAgent(agent)
    agent = null
    collectorApi = null

    done()
  })

  t.test('should not error out', (t) => {
    collectorApi.connect((error) => {
      t.error(error)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should pass through server-side configuration untouched', (t) => {
    collectorApi.connect((error, res) => {
      const ssc = res.payload
      t.deepEqual(ssc, validSsc)

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

tap.test('succeeds when given a different port number for redirect', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null
  let connection = null

  const validSsc = {
    agent_run_id: RUN_ID
  }

  t.beforeEach((done) => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    const response = {return_value: validSsc}

    redirection = nock(URL + ':443')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {return_value: {redirect_host: HOST + ':8089', security_policies: {}}})

    connection = nock(URL + ':8089')
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)

    done()
  })

  t.afterEach((done) => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()

    helper.unloadAgent(agent)
    agent = null
    collectorApi = null

    done()
  })

  t.test('should not error out', (t) => {
    collectorApi.connect((error) => {
      t.error(error)

      t.end()
    })
  })

  t.test('should have the correct hostname', (t) => {
    collectorApi.connect(() => {
      t.equal(collectorApi._agent.config.host, HOST)

      t.end()
    })
  })

  t.test('should have the correct port number', (t) => {
    collectorApi.connect(() => {
      t.equal(collectorApi._agent.config.port, '8089')

      t.end()
    })
  })

  t.test('should have a run ID', (t) => {
    collectorApi.connect(function test(error, res) {
      const ssc = res.payload
      t.equal(ssc.agent_run_id, RUN_ID)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should pass through server-side configuration untouched', (t) => {
    collectorApi.connect(function test(error, res) {
      const ssc = res.payload
      t.deepEqual(ssc, validSsc)

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

tap.test('succeeds after one 503 on preconnect', (t) => {
  t.autoend()

  let collectorApi = null
  let agent = null

  const valid = {
    agent_run_id: RUN_ID
  }

  const response = {return_value: valid}

  let failure = null
  let success = null
  let connection = null

  let bad = null
  let ssc = null

  t.beforeEach((done) => {
    fastSetTimeoutIncrementRef()

    nock.disableNetConnect()

    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    const redirectURL = helper.generateCollectorPath('preconnect')
    failure = nock(URL).post(redirectURL).reply(503)
    success = nock(URL)
      .post(redirectURL)
      .reply(200, {
        return_value: {redirect_host: HOST, security_policies: {}}
      })
    connection = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)

    done()
  })

  t.afterEach((done) => {
    restoreSetTimeout()

    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)

    done()
  })

  t.test('should not error out', (t) => {
    testConnect(t, () => {
      t.notOk(bad)
      t.end()
    })
  })

  t.test('should have a run ID', (t) => {
    testConnect(t, () => {
      t.equal(ssc.agent_run_id, RUN_ID)
      t.end()
    })
  })

  t.test('should pass through server-side configuration untouched', (t) => {
    testConnect(t, () => {
      t.deepEqual(ssc, valid)
      t.end()
    })
  })

  function testConnect(t, cb) {
    collectorApi.connect((error, res) => {
      bad = error
      ssc = res.payload

      t.ok(failure.isDone())
      t.ok(success.isDone())
      t.ok(connection.isDone())
      cb()
    })
  }
})

// TODO: 503 tests can likely be consolidated into single test func
// passed to t.test() while specifying different # of 503s.
tap.test('succeeds after five 503s on preconnect', (t) => {
  t.autoend()

  let collectorApi = null
  let agent = null

  const valid = {
    agent_run_id: RUN_ID
  }

  const response = {return_value: valid}

  let failure = null
  let success = null
  let connection = null

  let bad = null
  let ssc = null

  t.beforeEach((done) => {
    fastSetTimeoutIncrementRef()

    nock.disableNetConnect()

    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    const redirectURL = helper.generateCollectorPath('preconnect')
    failure = nock(URL).post(redirectURL).times(5).reply(503)
    success = nock(URL)
      .post(redirectURL)
      .reply(200, {
        return_value: {redirect_host: HOST, security_policies: {}}
      })
    connection = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)

    done()
  })

  t.afterEach((done) => {
    restoreSetTimeout()

    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)

    done()
  })


  t.test('should not error out', (t) => {
    testConnect(t, () => {
      t.notOk(bad)
      t.end()
    })
  })

  t.test('should have a run ID', (t) => {
    testConnect(t, () => {
      t.equal(ssc.agent_run_id, RUN_ID)
      t.end()
    })
  })

  t.test('should pass through server-side configuration untouched', (t) => {
    testConnect(t, () => {
      t.deepEqual(ssc, valid)
      t.end()
    })
  })


  function testConnect(t, cb) {
    collectorApi.connect((error, res) => {
      bad = error
      ssc = res.payload

      t.ok(failure.isDone())
      t.ok(success.isDone())
      t.ok(connection.isDone())
      cb()
    })
  }
})

tap.test('disconnects on force disconnect (410)', (t) => {
  t.autoend()

  let collectorApi = null
  let agent = null

  const exception = {
    exception: {
      message: 'fake force disconnect',
      error_type: 'NewRelic::Agent::ForceDisconnectException'
    }
  }

  let disconnect = null

  t.beforeEach((done) => {
    fastSetTimeoutIncrementRef()

    nock.disableNetConnect()

    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    const redirectURL = helper.generateCollectorPath('preconnect')
    disconnect = nock(URL).post(redirectURL).times(1).reply(410, exception)

    done()
  })

  t.afterEach((done) => {
    restoreSetTimeout()

    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)

    done()
  })

  t.test('should not have errored', (t) => {
    collectorApi.connect((err) => {
      t.error(err)

      t.ok(disconnect.isDone())

      t.end()
    })
  })

  t.test('should not have a response body', (t) => {
    collectorApi.connect((err, response) => {
      t.notOk(response.payload)

      t.ok(disconnect.isDone())

      t.end()
    })
  })
})

tap.test('retries preconnect until forced to disconnect (410)', (t) => {
  t.autoend()

  let collectorApi = null
  let agent = null

  const exception = {
    exception: {
      message: 'fake force disconnect',
      error_type: 'NewRelic::Agent::ForceDisconnectException'
    }
  }

  let failure = null
  let disconnect = null

  let capturedResponse = null

  t.beforeEach((done) => {
    fastSetTimeoutIncrementRef()

    nock.disableNetConnect()

    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    const redirectURL = helper.generateCollectorPath('preconnect')
    failure = nock(URL).post(redirectURL).times(500).reply(503)
    disconnect = nock(URL).post(redirectURL).times(1).reply(410, exception)

    done()
  })

  t.afterEach((done) => {
    restoreSetTimeout()

    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)

    done()
  })

  t.test('should have received shutdown response', (t) => {
    testConnect(t, () => {
      const shutdownCommand = CollectorResponse.AGENT_RUN_BEHAVIOR.SHUTDOWN

      t.ok(capturedResponse)
      t.equal(capturedResponse.agentRun, shutdownCommand)

      t.end()
    })
  })

  function testConnect(t, cb) {
    collectorApi.connect((error, response) => {
      capturedResponse = response

      t.ok(failure.isDone())
      t.ok(disconnect.isDone())
      cb()
    })
  }
})


tap.test('retries on receiving invalid license key (401)', (t) => {
  t.autoend()

  let collectorApi = null
  let agent = null

  const error = {
    exception: {
      message: 'Invalid license key. Please contact support@newrelic.com.',
      error_type: 'NewRelic::Agent::LicenseException'
    }
  }

  let failure = null
  let success = null
  let connect = null

  t.beforeEach((done) => {
    fastSetTimeoutIncrementRef()

    nock.disableNetConnect()

    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    const preconnectURL = helper.generateCollectorPath('preconnect')
    failure = nock(URL).post(preconnectURL).times(5).reply(401, error)
    success = nock(URL).post(preconnectURL).reply(200, {return_value: {}})
    connect = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, {return_value: {agent_run_id: 31338}})

    done()
  })

  t.afterEach((done) => {
    restoreSetTimeout()

    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)

    done()
  })

  t.test('should call the expected number of times', (t) => {
    testConnect(t, () => {
      t.end()
    })
  })

  function testConnect(t, cb) {
    collectorApi.connect(() => {
      t.ok(failure.isDone())
      t.ok(success.isDone())
      t.ok(connect.isDone())

      cb()
    })
  }
})

tap.test('in a LASP/CSP enabled agent', (t) => {
  const SECURITY_POLICIES_TOKEN = 'TEST-TEST-TEST-TEST'

  t.autoend()

  let agent = null
  let collectorApi = null
  let policies = null

  t.beforeEach((done) => {
    agent = setupMockedAgent()
    agent.config.security_policies_token = SECURITY_POLICIES_TOKEN

    collectorApi = new CollectorApi(agent)

    policies = securityPolicies()

    nock.disableNetConnect()

    done()
  })

  t.afterEach((done) => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()

    helper.unloadAgent(agent)
    agent = null
    collectorApi = null
    policies = null

    done()
  })

  t.test('should include security policies in api callback response', (t) => {
    const valid = {
      agent_run_id: RUN_ID,
      security_policies: policies
    }

    const response = {return_value: valid}

    const redirection = nock(URL + ':443')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {
        return_value: {
          redirect_host: HOST,
          security_policies: policies
        }
      })

    const connection = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)

    collectorApi.connect(function test(error, res) {
      t.deepEqual(res.payload, valid)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('drops data collected before connect when policies are updated', (t) => {
    agent.config.api.custom_events_enabled = true

    agent.customEventAggregator.add(['will be overwritten'])
    t.equal(agent.customEventAggregator.length, 1)

    const valid = {
      agent_run_id: RUN_ID,
      security_policies: policies
    }

    const response = {return_value: valid}

    const redirection = nock(URL + ':443')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {
        return_value: {
          redirect_host: HOST,
          security_policies: policies
        }
      })

    const connection = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)

    collectorApi.connect(function test(error, res) {
      t.deepEqual(res.payload, valid)

      t.equal(agent.customEventAggregator.length, 0)

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

function fastSetTimeoutIncrementRef() {
  global.setTimeout = function(cb) {
    const nodeTimeout = timeout(cb, 0)

    // This is a hack to keep tap from shutting down test early.
    // Is there a better way to do this?
    setImmediate(() => {
      nodeTimeout.ref()
    })

    return nodeTimeout
  }
}

function restoreSetTimeout() {
  global.setTimeout = timeout
}

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
