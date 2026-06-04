/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const PROXY_HOST = 'unique.newrelic.com'
const PROXY_PORT = '54532'
const PROXY_URL_WITH_PORT = `https://${PROXY_HOST}:${PROXY_PORT}`
const PROXY_URL_WITHOUT_PORT = `https://${PROXY_HOST}`
const httpAgentsPath = require.resolve('../../../lib/collector/http-agents')

// `https-proxy-agent` ships as ESM, and its dep graph imports `node:http`.
// If we top-level-require it from `http-agents.js`, that import locks the ESM
// `node:http` namespace exports to the *unwrapped* functions before our http
// instrumentation can monkey-patch them. Downstream consumers that reach for
// http via `await import('node:http')` (e.g. `@smithy/node-http-handler`, `undici`) then
// bypass our instrumentation entirely.
test('does not pollute ESM node:http namespace on load', async (t) => {
  require(httpAgentsPath)
  const agent = helper.instrumentMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })
  const http = require('node:http')
  assert.equal(http.request.name, 'wrappedRequest')
  const ns = await import('node:http')
  assert.equal(ns.request.name, 'wrappedRequest')
})

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
    const { HttpsProxyAgent } = require('https-proxy-agent')
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

test('proxySettingsPresent', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.proxySettingsPresent = require(httpAgentsPath).proxySettingsPresent
  })

  t.afterEach(() => {
    delete require.cache[httpAgentsPath]
  })

  await t.test('should return true when proxy is set', (t) => {
    const config = { proxy: PROXY_URL_WITH_PORT, proxy_host: '' }
    assert.equal(t.nr.proxySettingsPresent(config), true)
  })

  await t.test('should return true when proxy_host is set', (t) => {
    const config = { proxy: '', proxy_host: PROXY_HOST }
    assert.equal(t.nr.proxySettingsPresent(config), true)
  })

  await t.test('should return true when both proxy and proxy_host are set', (t) => {
    const config = { proxy: PROXY_URL_WITH_PORT, proxy_host: PROXY_HOST }
    assert.equal(t.nr.proxySettingsPresent(config), true)
  })

  await t.test('should return false when neither proxy nor proxy_host are set', (t) => {
    const config = { proxy: '', proxy_host: '' }
    assert.equal(t.nr.proxySettingsPresent(config), false)
  })
})

test('buildProxyUrl', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.buildProxyUrl = require(httpAgentsPath).buildProxyUrl
  })

  t.afterEach(() => {
    delete require.cache[httpAgentsPath]
  })

  await t.test('should return proxy url when proxy is set', (t) => {
    const config = { proxy: PROXY_URL_WITH_PORT }
    assert.equal(t.nr.buildProxyUrl(config), PROXY_URL_WITH_PORT)
  })

  await t.test('should build proxy url from proxy_host and proxy_port', (t) => {
    const config = {
      proxy_host: PROXY_HOST,
      proxy_port: PROXY_PORT,
      proxy_user: '',
      proxy_pass: ''
    }
    assert.equal(t.nr.buildProxyUrl(config), PROXY_URL_WITH_PORT)
  })

  await t.test('should build proxy url with auth', (t) => {
    const config = {
      proxy_host: PROXY_HOST,
      proxy_port: PROXY_PORT,
      proxy_user: 'user',
      proxy_pass: 'pass'
    }
    assert.equal(t.nr.buildProxyUrl(config), `https://user:pass@${PROXY_HOST}:${PROXY_PORT}`)
  })

  await t.test('should default to localhost:80 when no host/port specified', (t) => {
    const config = {
      proxy_user: '',
      proxy_pass: ''
    }
    assert.equal(t.nr.buildProxyUrl(config), 'https://localhost:80')
  })

  await t.test('should not include auth when proxy_pass is empty', (t) => {
    const config = {
      proxy_host: PROXY_HOST,
      proxy_port: PROXY_PORT,
      proxy_user: 'user',
      proxy_pass: ''
    }
    assert.equal(t.nr.buildProxyUrl(config), PROXY_URL_WITH_PORT)
  })
})
