/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const { HttpsProxyAgent } = require('https-proxy-agent')

const generateProxyAgentFactory = require('#agentlib/otel/metrics/generate-proxy-agent-factory.js')

const PROXY_HOST = 'proxy.example.com'
const PROXY_PORT = '8080'
const PROXY_USER = 'testuser'
const PROXY_PASS = 'testpass'

test('should return a function', () => {
  const agentConfig = {
    proxy: `https://${PROXY_HOST}:${PROXY_PORT}`,
    host: 'collector.newrelic.com',
    ssl: true
  }
  const factory = generateProxyAgentFactory({ agentConfig })
  assert.equal(typeof factory, 'function')
})

test('should return http.Agent for HTTP protocol', () => {
  const agentConfig = {
    proxy: `https://${PROXY_HOST}:${PROXY_PORT}`,
    host: 'collector.newrelic.com',
    ssl: true
  }
  const factory = generateProxyAgentFactory({ agentConfig })
  const agent = factory('http')

  assert.ok(agent instanceof http.Agent)
  // proxyEnv is an internal option and may not be exposed on the agent
})

test('should return HttpsProxyAgent for HTTPS protocol', () => {
  const agentConfig = {
    proxy: `https://${PROXY_HOST}:${PROXY_PORT}`,
    host: 'collector.newrelic.com',
    ssl: true
  }
  const factory = generateProxyAgentFactory({ agentConfig })
  const agent = factory('https')

  assert.ok(agent instanceof HttpsProxyAgent)
  assert.equal(agent.proxy.hostname, PROXY_HOST)
  assert.equal(agent.proxy.port, PROXY_PORT)
})

test('should handle uppercase protocol', () => {
  const agentConfig = {
    proxy: `https://${PROXY_HOST}:${PROXY_PORT}`,
    host: 'collector.newrelic.com',
    ssl: true
  }
  const factory = generateProxyAgentFactory({ agentConfig })
  const agent = factory('HTTP')

  assert.ok(agent instanceof http.Agent)
})

test('should handle proxy with authentication', () => {
  const agentConfig = {
    proxy_host: PROXY_HOST,
    proxy_port: PROXY_PORT,
    proxy_user: PROXY_USER,
    proxy_pass: PROXY_PASS,
    host: 'collector.newrelic.com',
    ssl: true
  }
  const factory = generateProxyAgentFactory({ agentConfig })
  const agent = factory('https')

  // proxyAgent returns a singleton, so we just verify it returns an agent instance
  assert.ok(agent instanceof HttpsProxyAgent)
})

test('should use provided logger', () => {
  const agentConfig = {
    proxy: `https://${PROXY_HOST}:${PROXY_PORT}`,
    host: 'collector.newrelic.com',
    ssl: true
  }
  const logCalls = []
  const mockLogger = {
    trace: (msg) => logCalls.push({ level: 'trace', msg })
  }
  const factory = generateProxyAgentFactory({ agentConfig, logger: mockLogger })

  factory('https')

  assert.equal(logCalls.length, 1)
  assert.equal(logCalls[0].level, 'trace')
  assert.equal(logCalls[0].msg, 'returning https proxy agent')
})

test('should log for HTTP protocol', () => {
  const agentConfig = {
    proxy: `https://${PROXY_HOST}:${PROXY_PORT}`,
    host: 'collector.newrelic.com',
    ssl: true
  }
  const logCalls = []
  const mockLogger = {
    trace: (msg) => logCalls.push({ level: 'trace', msg })
  }
  const factory = generateProxyAgentFactory({ agentConfig, logger: mockLogger })

  factory('http')

  assert.equal(logCalls.length, 1)
  assert.equal(logCalls[0].level, 'trace')
  assert.equal(logCalls[0].msg, 'returning http proxy agent')
})

test('should handle proxy_host and proxy_port configuration', () => {
  const agentConfig = {
    proxy_host: PROXY_HOST,
    proxy_port: PROXY_PORT,
    proxy_user: '',
    proxy_pass: '',
    host: 'collector.newrelic.com',
    ssl: true
  }
  const factory = generateProxyAgentFactory({ agentConfig })
  const agent = factory('https')

  assert.ok(agent instanceof HttpsProxyAgent)
  assert.equal(agent.proxy.hostname, PROXY_HOST)
  assert.equal(agent.proxy.port, PROXY_PORT)
})
