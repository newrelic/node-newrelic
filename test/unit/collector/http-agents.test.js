/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { HttpsProxyAgent } = require('https-proxy-agent')

const PROXY_HOST = 'unique.newrelic.com'
const PROXY_PORT = '54532'
const PROXY_URL_WITH_PORT = `https://${PROXY_HOST}:${PROXY_PORT}`
const PROXY_URL_WITHOUT_PORT = `https://${PROXY_HOST}`
const httpAgentsPath = require.resolve('../../../lib/collector/http-agents')

test('keepAlive agent', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.keepAliveAgent = require(httpAgentsPath).keepAliveAgent
  })

  t.afterEach(() => {
    delete require.cache[httpAgentsPath]
  })

  await t.test('configured without params', (t) => {
    const agent = t.nr.keepAliveAgent()
    assert.ok(agent, 'should be created successfully')
    assert.equal(agent.protocol, 'https:', 'should be set to https')
    assert.equal(agent.keepAlive, true, 'should be keepAlive')
  })

  await t.test('configured with keepAlive set to false', (t) => {
    const agent = t.nr.keepAliveAgent({ keepAlive: false })
    assert.ok(agent, 'should be created successfully')
    assert.equal(agent.protocol, 'https:', 'should be set to https')
    assert.equal(agent.keepAlive, true, 'should be keepAlive')
  })

  await t.test('should return singleton instance if called more than once', (t) => {
    const agent = t.nr.keepAliveAgent({ keepAlive: false })
    const agent2 = t.nr.keepAliveAgent()
    assert.equal(agent, agent2)
  })
})

test('proxy agent', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.proxyAgent = require(httpAgentsPath).proxyAgent
  })

  t.afterEach(() => {
    delete require.cache[httpAgentsPath]
  })

  await t.test('configured without params', (t) => {
    assert.throws(() => t.nr.proxyAgent(), 'should throw without config')
  })

  await t.test('configured with proxy host and proxy port', (t) => {
    const config = {
      proxy_host: PROXY_HOST,
      proxy_port: PROXY_PORT
    }
    const agent = t.nr.proxyAgent(config)
    assert.ok(agent, 'should be created successfully')
    assert.equal(agent.proxy.hostname, PROXY_HOST, 'should have correct proxy host')
    assert.equal(agent.proxy.port, PROXY_PORT, 'should have correct proxy port')
    assert.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    assert.equal(agent.keepAlive, true, 'should be keepAlive')
  })

  await t.test('configured with proxy url:port', (t) => {
    const config = {
      proxy: PROXY_URL_WITH_PORT
    }
    const agent = t.nr.proxyAgent(config)
    assert.ok(agent, 'should be created successfully')
    assert.equal(agent.proxy.hostname, PROXY_HOST, 'should have correct proxy host')
    assert.equal(agent.proxy.port, PROXY_PORT, 'should have correct proxy port')
    assert.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    assert.equal(agent.keepAlive, true, 'should be keepAlive')
  })

  await t.test('configured with proxy url only', (t) => {
    const config = {
      proxy: PROXY_URL_WITHOUT_PORT
    }
    const agent = t.nr.proxyAgent(config)
    assert.ok(agent, 'should be created successfully')
    assert.equal(agent.proxy.hostname, PROXY_HOST, 'should have correct proxy host')
    assert.equal(agent.proxy.port, '', 'should have correct proxy port')
    assert.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    assert.equal(agent.keepAlive, true, 'should be keepAlive')
    assert.equal(agent.connectOpts.secureEndpoint, undefined)
  })

  await t.test('should return singleton of proxyAgent if called more than once', (t) => {
    const config = { proxy: PROXY_URL_WITH_PORT }
    const agent = t.nr.proxyAgent(config)
    const agent2 = t.nr.proxyAgent()
    assert.equal(agent, agent2)
  })

  await t.test('configured with certificates defined', (t) => {
    const config = {
      proxy: PROXY_URL_WITH_PORT,
      certificates: ['cert1'],
      ssl: true
    }
    const agent = t.nr.proxyAgent(config)
    assert.equal(agent instanceof HttpsProxyAgent, true)
    assert.equal(agent.proxy.host, `${PROXY_HOST}:${PROXY_PORT}`, 'should have correct proxy host')
    assert.deepStrictEqual(agent.connectOpts.ca, ['cert1'], 'should have correct certs')
    assert.equal(agent.connectOpts.keepAlive, true, 'should be keepAlive')
    assert.equal(agent.connectOpts.secureEndpoint, true)
  })

  await t.test('should default to localhost if no proxy_host or proxy_port is specified', (t) => {
    const config = {
      proxy_user: 'unit-test',
      proxy_pass: 'secret',
      ssl: true
    }
    const agent = t.nr.proxyAgent(config)
    assert.ok(agent, 'should be created successfully')
    assert.equal(agent.proxy.hostname, 'localhost', 'should have correct proxy host')
    assert.equal(agent.proxy.port, '80', 'should have correct proxy port')
    assert.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    assert.equal(agent.proxy.username, 'unit-test', 'should have correct basic auth username')
    assert.equal(agent.proxy.password, 'secret', 'should have correct basic auth password')
    assert.equal(agent.connectOpts.secureEndpoint, true)
  })

  await t.test('should not parse basic auth user if password is empty', (t) => {
    const config = {
      proxy_user: 'unit-test',
      proxy_pass: '',
      ssl: true
    }
    const agent = t.nr.proxyAgent(config)
    assert.ok(agent, 'should be created successfully')
    assert.equal(agent.proxy.hostname, 'localhost', 'should have correct proxy host')
    assert.equal(agent.proxy.port, '80', 'should have correct proxy port')
    assert.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    assert.equal(agent.proxy.username, '', 'should not have basic auth username')
    assert.equal(agent.proxy.password, '', 'should not have basic auth password')
  })
})
