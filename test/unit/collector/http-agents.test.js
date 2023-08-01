/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const { readFileSync: read } = require('fs')
const { join } = require('path')

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
    const config = {
      proxy: PROXY_URL_WITH_PORT,
      certificates: [read(join(__dirname, '../../lib/ca-certificate.crt'), 'utf8')]
    }
    agent = proxyAgent(config)
    t.ok(agent, 'should be created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'should have correct proxy host')
    t.equal(agent.proxy.port, PROXY_PORT, 'should have correct proxy port')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })
})
