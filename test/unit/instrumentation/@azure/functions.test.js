/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')
const GenericShim = require('#agentlib/shim/shim.js')
const { DESTINATIONS: DESTS } = require('#agentlib/transaction/index.js')

/** */

const agent = helper.loadMockedAgent()
const shim = new GenericShim(agent, 'azure-functions')
const initialize = require('#agentlib/instrumentation/@azure/functions.js')

const handler = async function(request, context) {
  assert.equal(request.url, 'http://example.com')
  return 'ok'
}
const request = {
  url: 'http://example.com',
  method: 'GET',
  headers: {
    foo: 'bar'
  }
}
const options = {
  handler
}
const mockApi = {
  handlers: {},
  request(method) {
    method = method.toUpperCase()
    if (Object.hasOwn(mockApi.handlers, method) === false) {
      throw Error(`no handler registered for method: ${method}`)
    }
    request.method = method
    return mockApi.handlers[method](request, {
      invocationId: 'test-123',
      functionName: 'test-func',
      options: {
        trigger: {
          type: 'httpTrigger'
        }
      }
    })
  },
  app: {
    http(name, options) {
      mockApi.handlers.GET = options.handler
    },
    get(name, options) {
      mockApi.handlers.GET = options.handler
    },
    put(name, options) {
      mockApi.handlers.PUT = options.handler
    },
    post(name, options) {
      mockApi.handlers.POST = options.handler
    },
    patch(name, options) {
      mockApi.handlers.PATCH = options.handler
    },
    deleteRequest(name, options) {
      mockApi.handlers.DELETE = options.handler
    }
  }
}

initialize(agent, mockApi, 'azure-functions', shim)
for (const key of Object.keys(mockApi.app)) {
  const isWrapped = shim.isWrapped(mockApi.app[key])
  assert.equal(isWrapped, true)
}

mockApi.app.http('a-test', options)
mockApi.request('get').then(response => {
  assert.equal(response, 'ok')

  const transactions = agent.__testData.transactions.elements
  assert.equal(transactions.length, 1)
  const tx = transactions[0]

  let attributes = tx.trace.attributes.get(DESTS.TRANS_EVENT)
  assert.equal(attributes['request.uri'], '/')

  attributes = tx.trace.attributes.get(DESTS.TRANS_COMMON)
  assert.equal(attributes['faas.invocation_id'], 'test-123')
  assert.equal(attributes['faas.name'], 'test-func')
  assert.equal(attributes['faas.trigger'], 'httpTrigger')
})
