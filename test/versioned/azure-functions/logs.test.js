/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { once } = require('node:events')

const helper = require('../../lib/agent_helper.js')
const { removeMatchedModules } = require('../../lib/cache-buster.js')
const GenericShim = require('../../../lib/shim/shim.js')

const MODULE_NAME = 'azure-functions'
const TRACE_ID = '0af7651916cd43dd8448eb211c80319c'
const SPAN_ID = 'b9c7c989f97918e1'

const basicHttpRequest = {
  url: 'http://example.com',
  method: 'GET',
  headers: {
    foo: 'bar'
  }
}

// See https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=javascript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4#http-response
class AzureFunctionHttpResponse {
  body
  jsonBody // Should be a serializable object
  status // e.g. 200
  headers // key-value hash
  cookies // array of cookie strings
}

test.beforeEach((ctx) => {
  ctx.nr = {}

  ctx.nr.agent = helper.loadMockedAgent()
  ctx.nr.shim = new GenericShim(ctx.nr.agent, 'azure-functions')

  process.env.WEBSITE_OWNER_NAME = 'b999997b-cb91-49e0-b922-c9188372bdba+testing-rg-EastUS2webspace-Linux'
  process.env.WEBSITE_RESOURCE_GROUP = 'test-group'
  process.env.WEBSITE_SITE_NAME = 'test-site'
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeMatchedModules(/lib\/instrumentation\/@azure\/functions\.js/)

  delete process.env.WEBSITE_OWNER_NAME
  delete process.env.WEBSITE_RESOURCE_GROUP
  delete process.env.WEBSITE_SITE_NAME
})

function bootstrapModule({ t, request = basicHttpRequest }) {
  t.nr.initialize = require('../../../lib/instrumentation/@azure/functions.js')

  const logHookCallbacks = []

  const mockApi = {
    httpHandlers: {},
    httpRequest(method) {
      method = method.toUpperCase()
      if (method === 'HTTP') method = 'GET'
      if (method === 'DELETEREQUEST') method = 'DELETE'
      if (Object.hasOwn(mockApi.httpHandlers, method) === false) {
        throw Error(`no handler registered for method: ${method}`)
      }
      request.method = method
      function fireLogHook(message, level) {
        for (const cb of logHookCallbacks) {
          cb({ message, level })
        }
      }
      return mockApi.httpHandlers[method](request, {
        invocationId: 'test-123',
        functionName: 'test-func',
        options: {
          trigger: {
            type: 'httpTrigger'
          }
        },
        log(message) { fireLogHook(message, 'information') },
        info(message) { fireLogHook(message, 'information') },
        warn(message) { fireLogHook(message, 'warning') },
        error(message) { fireLogHook(message, 'error') },
        debug(message) { fireLogHook(message, 'debug') },
        trace(message) { fireLogHook(message, 'trace') }
      })
    },
    app: {
      hook: {
        log(callback) {
          logHookCallbacks.push(callback)
        }
      },
      http(name, options) {
        mockApi.httpHandlers.GET = options.handler
      },
      get(name, options) {
        mockApi.httpHandlers.GET = options.handler ?? options
      },
      put(name, options) {
        mockApi.httpHandlers.PUT = options.handler
      },
      post(name, options) {
        mockApi.httpHandlers.POST = options.handler
      },
      patch(name, options) {
        mockApi.httpHandlers.PATCH = options.handler
      },
      deleteRequest(name, options) {
        mockApi.httpHandlers.DELETE = options.handler
      }
    }
  }
  t.nr.mockApi = mockApi
}

test('adds logs from azure functions to agent logs', async (t) => {
  const clientRequest = structuredClone(basicHttpRequest)
  clientRequest.headers = {
    traceparent: `00-${TRACE_ID}-${SPAN_ID}-00`,
    tracestate: `33@nr=0-0-33-2827902-${SPAN_ID}-e8b91a159289ff74-1-1.23456-1518469636035`
  }

  bootstrapModule({ t, request: clientRequest })
  const { agent, initialize, mockApi, shim } = t.nr
  agent.config.distributed_tracing.enabled = true
  agent.config.account_id = '33'
  agent.config.trusted_account_key = '33'
  initialize(agent, mockApi, MODULE_NAME, shim)

  const handler = async function (_request, context) {
    context.log('test message')
    const response = new AzureFunctionHttpResponse()
    response.body = 'ok'
    response.status = 200
    return response
  }
  const options = { handler }

  const txFinished = once(agent, 'transactionFinished')
  mockApi.app.get('a-test', options)
  const response = await mockApi.httpRequest('get')
  assert.equal(response.body, 'ok')

  const [tx] = await txFinished
  assert.ok(tx)

  const agentLogs = agent.logs.getEvents()
  assert.equal(agentLogs.length, 1, 'should have one log entry in agent logs')
  assert.equal(agentLogs[0].message, 'test message', 'log message should match')
  assert.equal(agentLogs[0].level, 'information', 'log level should match')
  assert.equal(agentLogs[0]['trace.id'], tx.traceId, 'log should include trace id')
})

// https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=javascript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4#log-levels
test('captures correct log level for each context log method', async (t) => {
  bootstrapModule({ t })
  const { agent, initialize, mockApi, shim } = t.nr
  initialize(agent, mockApi, MODULE_NAME, shim)

  const handler = async function (_request, context) {
    context.log('log message')
    context.info('info message')
    context.warn('warn message')
    context.error('error message')
    context.debug('debug message')
    context.trace('trace message')
    const response = new AzureFunctionHttpResponse()
    response.body = 'ok'
    response.status = 200
    return response
  }

  const txFinished = once(agent, 'transactionFinished')
  mockApi.app.get('a-test', { handler })
  await mockApi.httpRequest('get')
  await txFinished

  const agentLogs = agent.logs.getEvents()
  assert.equal(agentLogs.length, 6, 'should have one log entry per context log call')

  const byMessage = Object.fromEntries(agentLogs.map((l) => [l.message, l.level]))
  assert.equal(byMessage['log message'], 'information', 'context.log() should produce information level')
  assert.equal(byMessage['info message'], 'information', 'context.info() should produce information level')
  assert.equal(byMessage['warn message'], 'warning', 'context.warn() should produce warning level')
  assert.equal(byMessage['error message'], 'error', 'context.error() should produce error level')
  assert.equal(byMessage['debug message'], 'debug', 'context.debug() should produce debug level')
  assert.equal(byMessage['trace message'], 'trace', 'context.trace() should produce trace level')
})
