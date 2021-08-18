/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const nock = require('nock')

const helper = require('../../lib/agent_helper')
const CollectorApi = require('../../../lib/collector/api')
const securityPolicies = require('../../lib/fixtures').securityPolicies

const HOST = 'collector.newrelic.com'
const PORT = 8080
const URL = 'https://' + HOST
const RUN_ID = 1337

tap.test('when high_security: true', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  t.beforeEach(() => {
    agent = setupMockedAgent()
    agent.config.high_security = true

    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()
  })

  t.afterEach(() => {
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
  })

  t.test('should send high_security:true in preconnect payload', (t) => {
    const expectedPreconnectBody = [{ high_security: true }]

    const preconnect = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'), expectedPreconnectBody)
      .reply(200, {
        return_value: {
          redirect_host: HOST
        }
      })

    const connectResponse = { return_value: { agent_run_id: RUN_ID } }
    const connect = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, connectResponse)

    collectorApi._login(function test(err) {
      // Request will only be successful if body matches expected
      t.error(err)

      preconnect.done()
      connect.done()
      t.end()
    })
  })
})

tap.test('when high_security: false', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach(() => {
    agent = setupMockedAgent()
    agent.config.high_security = false

    api = new CollectorApi(agent)

    nock.disableNetConnect()
  })

  t.afterEach(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()

    helper.unloadAgent(agent)
    agent = null
    api = null
  })

  t.test('should send high_security:true in preconnect payload', (t) => {
    const expectedPreconnectBody = [{ high_security: false }]

    const preconnect = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'), expectedPreconnectBody)
      .reply(200, {
        return_value: {
          redirect_host: HOST
        }
      })

    const connectResponse = { return_value: { agent_run_id: RUN_ID } }
    const connect = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, connectResponse)

    api._login(function test(err) {
      // Request will only be successful if body matches expected
      t.error(err)

      preconnect.done()
      connect.done()
      t.end()
    })
  })
})

tap.test('in a LASP-enabled agent', (t) => {
  const SECURITY_POLICIES_TOKEN = 'TEST-TEST-TEST-TEST'

  t.autoend()

  let agent = null
  let collectorApi = null
  let policies = null

  t.beforeEach(() => {
    agent = setupMockedAgent()
    agent.config.security_policies_token = SECURITY_POLICIES_TOKEN

    collectorApi = new CollectorApi(agent)

    policies = securityPolicies()

    nock.disableNetConnect()
  })

  t.afterEach(() => {
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
  })

  // HSM should never be true when LASP/CSP enabled but payload should still be sent.
  t.test('should send token in preconnect payload with high_security:false', (t) => {
    const expectedPreconnectBody = [
      {
        security_policies_token: SECURITY_POLICIES_TOKEN,
        high_security: false
      }
    ]

    const preconnect = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'), expectedPreconnectBody)
      .reply(200, {
        return_value: {
          redirect_host: HOST,
          security_policies: {}
        }
      })

    collectorApi._login(function test(err) {
      // Request will only be successful if body matches expected
      t.error(err)

      preconnect.done()
      t.end()
    })
  })

  t.test('should fail if preconnect res is missing expected policies', (t) => {
    const redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {
        return_value: {
          redirect_host: HOST,
          security_policies: {}
        }
      })

    collectorApi._login(function test(err, response) {
      t.error(err)
      t.equal(response.shouldShutdownRun(), true)

      redirection.done()
      t.end()
    })
  })

  t.test('should fail if agent is missing required policy', (t) => {
    policies.test = { required: true }

    const redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {
        return_value: {
          redirect_host: HOST,
          security_policies: policies
        }
      })

    collectorApi._login(function test(err, response) {
      t.error(err)
      t.equal(response.shouldShutdownRun(), true)

      redirection.done()
      t.end()
    })
  })
})

tap.test('should copy request headers', (t) => {
  let agent = null
  let collectorApi = null

  agent = setupMockedAgent()
  collectorApi = new CollectorApi(agent)

  nock.disableNetConnect()

  t.teardown(() => {
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
  })

  const reqHeaderMap = {
    'X-NR-TEST-HEADER': 'TEST VALUE'
  }

  const valid = {
    agent_run_id: RUN_ID,
    request_headers_map: reqHeaderMap
  }

  const response = { return_value: valid }

  const redirection = nock(URL + ':8080')
    .post(helper.generateCollectorPath('preconnect'))
    .reply(200, { return_value: { redirect_host: HOST, security_policies: {} } })

  const connection = nock(URL).post(helper.generateCollectorPath('connect')).reply(200, response)

  collectorApi._login(function test() {
    t.same(collectorApi._reqHeadersMap, reqHeaderMap)
    redirection.done()
    connection.done()

    t.end()
  })
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

  t.beforeEach(() => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    const response = { return_value: validSsc }

    redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, { return_value: { redirect_host: HOST, security_policies: {} } })
    connection = nock(URL).post(helper.generateCollectorPath('connect')).reply(200, response)
  })

  t.afterEach(() => {
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
  })

  t.test('should not error out', (t) => {
    collectorApi._login(function test(error) {
      t.error(error)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should have a run ID', (t) => {
    collectorApi._login(function test(error, res) {
      const ssc = res.payload
      t.equal(ssc.agent_run_id, RUN_ID)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should pass through server-side configuration untouched', (t) => {
    collectorApi._login(function test(error, res) {
      const ssc = res.payload
      t.same(ssc, validSsc)

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

tap.test('receiving 503 response from preconnect', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null

  t.beforeEach(() => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    redirection = redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(503)
  })

  t.afterEach(() => {
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
  })

  t.test('should not have gotten an error', (t) => {
    collectorApi._login(function test(error) {
      t.error(error)
      redirection.done()

      t.end()
    })
  })

  t.test('should have passed on the status code', (t) => {
    collectorApi._login(function test(error, response) {
      t.error(error)
      redirection.done()

      t.equal(response.status, 503)

      t.end()
    })
  })
})

tap.test('receiving no hostname from preconnect', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null
  let connection = null

  const validSsc = {
    agent_run_id: RUN_ID
  }

  t.beforeEach(() => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    const response = { return_value: validSsc }

    redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, { return_value: { redirect_host: '', security_policies: {} } })

    connection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)
  })

  t.afterEach(() => {
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
  })

  t.test('should not error out', (t) => {
    collectorApi._login(function test(error) {
      t.error(error)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should use preexisting collector hostname', (t) => {
    collectorApi._login(function test() {
      t.equal(agent.config.host, HOST)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should pass along server-side configuration from collector', (t) => {
    collectorApi._login(function test(error, res) {
      const ssc = res.payload
      t.equal(ssc.agent_run_id, RUN_ID)

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

tap.test('receiving a weirdo redirect name from preconnect', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null
  let connection = null

  const validSsc = {
    agent_run_id: RUN_ID
  }

  t.beforeEach(() => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    const response = { return_value: validSsc }

    redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {
        return_value: {
          redirect_host: HOST + ':chug:8089',
          security_policies: {}
        }
      })

    connection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('connect'))
      .reply(200, response)
  })

  t.afterEach(() => {
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
  })

  t.test('should not error out', (t) => {
    collectorApi._login(function test(error) {
      t.error(error)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should use preexisting collector hostname', (t) => {
    collectorApi._login(function test() {
      t.equal(agent.config.host, HOST)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should use preexisting collector port number', (t) => {
    collectorApi._login(function test() {
      t.equal(agent.config.port, PORT)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should pass along server-side configuration from collector', (t) => {
    collectorApi._login(function test(error, res) {
      const ssc = res.payload
      t.equal(ssc.agent_run_id, RUN_ID)

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

tap.test('receiving no config back from connect', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null
  let connection = null

  t.beforeEach(() => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, { return_value: { redirect_host: HOST, security_policies: {} } })

    connection = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, { return_value: null })
  })

  t.afterEach(() => {
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
  })

  t.test('should have gotten an error', (t) => {
    collectorApi._login(function test(error) {
      t.ok(error)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should have gotten an informative error message', (t) => {
    collectorApi._login(function test(error) {
      t.equal(error.message, 'No agent run ID received from handshake.')

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should pass along no server-side configuration from collector', (t) => {
    collectorApi._login(function test(error, res) {
      const ssc = res.payload
      t.notOk(ssc)

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

tap.test('receiving 503 response from connect', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null
  let connection = null

  t.beforeEach(() => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, { return_value: { redirect_host: HOST, security_policies: {} } })

    connection = nock(URL).post(helper.generateCollectorPath('connect')).reply(503)
  })

  t.afterEach(() => {
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
  })

  t.test('should not have gotten an error', (t) => {
    collectorApi._login(function test(error) {
      t.error(error)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should have passed on the status code', (t) => {
    collectorApi._login(function test(error, response) {
      t.error(error)
      redirection.done()
      connection.done()

      t.equal(response.status, 503)

      t.end()
    })
  })
})

tap.test('receiving 200 response to connect but no data', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let redirection = null
  let connection = null

  t.beforeEach(() => {
    agent = setupMockedAgent()
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    redirection = nock(URL + ':8080')
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, { return_value: { redirect_host: HOST, security_policies: {} } })

    connection = nock(URL).post(helper.generateCollectorPath('connect')).reply(200)
  })

  t.afterEach(() => {
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
  })

  t.test('should have gotten an error', (t) => {
    collectorApi._login(function test(error) {
      t.ok(error)

      redirection.done()
      connection.done()

      t.end()
    })
  })

  t.test('should have gotten an informative error message', (t) => {
    collectorApi._login(function test(error) {
      t.equal(error.message, 'No agent run ID received from handshake.')

      redirection.done()
      connection.done()

      t.end()
    })
  })
})

function setupMockedAgent() {
  const agent = helper.loadMockedAgent({
    host: HOST,
    port: PORT,
    app_name: ['TEST'],
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
  agent.reconfigure = function () {}
  agent.setState = function () {}

  return agent
}
