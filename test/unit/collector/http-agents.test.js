/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')
const PROXY_HOST = 'unique.newrelic.com'
const PROXY_PORT = 54532
const PROXY_URL_WITH_PORT = `https://${PROXY_HOST}:${PROXY_PORT}`
const PROXY_URL_WITHOUT_PORT = `https://${PROXY_HOST}`

tap.test('keepAlive agent', (t) => {
  t.autoend()
  let agent
  let moduleName
  let keepAliveAgent

  t.beforeEach(() => {
    // We do this to avoid the persistent caching of the agent in this module
    moduleName = require.resolve('../../../lib/collector/http-agents')
    keepAliveAgent = require(moduleName).keepAliveAgent
  })
  t.afterEach(() => {
    agent = null
    delete require.cache[moduleName]
  })

  t.test('configured without params', (t) => {
    agent = keepAliveAgent()
    t.ok(agent, 'should be created successfully')
    t.equal(agent.protocol, 'https:', 'should be set to https')
    t.equal(agent.keepAlive, true, 'should be keepAlive')
    t.end()
  })

  t.test('configured with keepAlive set to false', (t) => {
    agent = keepAliveAgent({ keepAlive: false })
    t.ok(agent, 'should be created successfully')
    t.equal(agent.protocol, 'https:', 'should be set to https')
    t.equal(agent.keepAlive, true, 'should override config and be keepAlive')
    t.end()
  })

  t.test('should return singleton instance if called more than once', (t) => {
    agent = keepAliveAgent({ keepAlive: false })
    const agent2 = keepAliveAgent()
    t.same(agent, agent2)
    t.end()
  })
})
tap.test('proxy agent', (t) => {
  t.autoend()
  let agent
  let moduleName
  let proxyAgent

  t.beforeEach(() => {
    // We do this to avoid the persistent caching of the agent in this module
    moduleName = require.resolve('../../../lib/collector/http-agents')
    proxyAgent = require(moduleName).proxyAgent
  })
  t.afterEach(() => {
    agent = null
    delete require.cache[moduleName]
  })

  t.test('configured without params', (t) => {
    t.throws(() => (agent = proxyAgent()), 'should throw without config')
    t.ok(() => (agent = proxyAgent({})), 'should not throw when config has no content')
    t.notOk(agent, 'agent should not be created without valid config')
    t.end()
  })

  t.test('configured with proxy host and proxy port', (t) => {
    const config = {
      proxy_host: PROXY_HOST,
      proxy_port: PROXY_PORT
    }
    agent = proxyAgent(config)
    t.ok(agent, 'should be created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'should have correct proxy host')
    t.equal(agent.proxy.port, PROXY_PORT, 'should have correct proxy port')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })

  t.test('configured with proxy url:port', (t) => {
    const config = {
      proxy: PROXY_URL_WITH_PORT
    }
    agent = proxyAgent(config)
    t.ok(agent, 'should be created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'should have correct proxy host')
    t.equal(agent.proxy.port, PROXY_PORT, 'should have correct proxy port')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })

  t.test('should return singleton of proxyAgent if called more than once', (t) => {
    const config = {
      proxy: PROXY_URL_WITH_PORT
    }
    agent = proxyAgent(config)
    const agent2 = proxyAgent()
    t.same(agent, agent2)
    t.end()
  })

  t.test('configured with proxy url only', (t) => {
    const config = {
      proxy: PROXY_URL_WITHOUT_PORT
    }
    agent = proxyAgent(config)
    t.ok(agent, 'should be created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'should have correct proxy host')
    t.equal(agent.proxy.port, 80, 'in the absence of a defined port, port should be 80')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })

  t.test('configured with certificates defined', (t) => {
    const { proxyAgent } = proxyquire('../../../lib/collector/http-agents', {
      'https-proxy-agent': Mock
    })

    const config = {
      proxy: PROXY_URL_WITH_PORT,
      certificates: ['cert1']
    }
    function Mock(args) {
      t.same(args.ca, ['cert1'], 'should have correct certs')
      t.equal(args.host, PROXY_HOST, 'should have correct proxy host')
      t.equal(args.port, `${PROXY_PORT}`, 'should have correct proxy port')
      t.equal(args.protocol, 'https:', 'should be set to https')
      t.equal(args.keepAlive, true, 'should be keepAlive')
      t.end()
    }

    proxyAgent(config)
  })

  t.test('should default to localhost if no proxy_host or proxy_port is specified', (t) => {
    const config = {
      proxy_user: 'unit-test',
      proxy_pass: 'secret'
    }
    agent = proxyAgent(config)
    t.ok(agent, 'should be created successfully')
    t.equal(agent.proxy.host, 'localhost', 'should have correct proxy host')
    t.equal(agent.proxy.port, 80, 'should have correct proxy port')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.auth, 'unit-test:secret', 'should have correct auth')
    t.end()
  })

  t.test('should not append password to auth if it is an empty string', (t) => {
    const config = {
      proxy_user: 'unit-test',
      proxy_pass: ''
    }
    agent = proxyAgent(config)
    t.ok(agent, 'should be created successfully')
    t.equal(agent.proxy.host, 'localhost', 'should have correct proxy host')
    t.equal(agent.proxy.port, 80, 'should have correct proxy port')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.auth, 'unit-test', 'should have correct auth')
    t.end()
  })
})
