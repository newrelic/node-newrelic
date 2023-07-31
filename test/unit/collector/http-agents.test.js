/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

// keepAliveAgent,
const { readFileSync: read } = require('fs')
const { join } = require('path')

// const HOST = 'collector.newrelic.com'
// const PORT = 443
const PROXY_HOST = 'unique.newrelic.com'
const PROXY_PORT = 54532
// const OTLP_ENDPOINT = 'otlp.nr-data.net'
// const URL_WITH_PORT = `https://${HOST}:${PORT}`
// const URL_WITHOUT_PORT = `https://${HOST}`
const PROXY_URL_WITH_PORT = `https://${PROXY_HOST}:${PROXY_PORT}`
const PROXY_URL_WITHOUT_PORT = `https://${PROXY_HOST}`

/* options branches

config.certificates && config.certificates.length

 */

// tap.test('keepalive', (t) => {
//     t.autoend()
//     let httpAgent
//     let request
//
//     t.before(() => {
//         createTestestServer({})
//     })
//
//     t.test('keepAlive agent creation', (t) => {
//         httpAgent = keepAliveAgent()
//         t.ok(httpAgent, 'keep alive agent should be ok')
//         t.ok(httpAgent.options.keepAlive, true)
//         t.ok(httpAgent.protocol, 'https:', 'should be set to https')
//         t.end()
//     })
//
//     // t.test('request with keepAlive agent', async (t) => {
//     //     const requestOptions = setOptions({
//     //         host: 'staging-collector.newrelic.com'
//     //     }, httpAgent)
//     //     request = await https.request(requestOptions)
//     //     // console.log("request", request)
//     //     t.end()
//     // })
//
//     t.teardown(() => {
//         httpAgent = null
//         // server.close()
//         //server = null
//     })
// })
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

  t.test('creation without params', (t) => {
    t.throws(() => proxyAgent(), 'should throw without config')
    t.ok(() => proxyAgent({}), 'should create successfully when config has no content')
    t.end()
  })

  t.test('creation with proxy host and proxy port', (t) => {
    console.log('PROXY AGENT', proxyAgent)
    const config = {
      proxy_host: PROXY_HOST,
      proxy_port: PROXY_PORT
    }
    t.doesNotThrow(() => (agent = proxyAgent(config)), 'should create without throwing')
    t.ok(agent, 'agent is created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'proxy host should be correct')
    t.equal(agent.proxy.port, PROXY_PORT, 'proxy port should be correct')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })

  t.test('creation with proxy url:port', (t) => {
    const config = {
      proxy: PROXY_URL_WITH_PORT
    }
    t.doesNotThrow(() => (agent = proxyAgent(config)), 'should create without throwing')
    t.ok(agent, 'agent is created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'proxy host should be correct')
    t.equal(agent.proxy.port, PROXY_PORT, 'proxy port should be correct')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })

  t.test('creation with proxy url only', (t) => {
    const config = {
      proxy: PROXY_URL_WITHOUT_PORT
    }
    t.doesNotThrow(() => (agent = proxyAgent(config)), 'should create without throwing')
    t.ok(agent, 'agent is created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'proxy host should be correct')
    t.equal(agent.proxy.port, 80, 'in the absence of a defined port, port should be 80')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })

  t.test('creation with certificates defined', (t) => {
    const config = {
      proxy: PROXY_URL_WITH_PORT,
      certificates: [read(join(__dirname, '../../lib/ca-certificate.crt'), 'utf8')]
    }
    t.doesNotThrow(() => (agent = proxyAgent(config)), 'should create without throwing')
    t.ok(agent, 'agent is created successfully')
    t.equal(agent.proxy.host, PROXY_HOST, 'proxy host should be correct')
    t.equal(agent.proxy.port, PROXY_PORT, 'proxy port should be correct')
    t.equal(agent.proxy.protocol, 'https:', 'should be set to https')
    t.equal(agent.proxy.keepAlive, true, 'should be keepAlive')
    t.end()
  })
})
