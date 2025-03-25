/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { httpAttr, clientMapper, rpcMapper, serverMapper } = require('#agentlib/otel/attr-mapping/http.js')
const AttributeReconciler = require('#agentlib/otel/attr-reconciler.js')
const helper = require('#testlib/agent_helper.js')
const sinon = require('sinon')
const test = require('node:test')
const assert = require('node:assert')
const {
  ATTR_GRPC_STATUS_CODE,
  ATTR_RPC_METHOD,
  ATTR_RPC_SYSTEM,
  ATTR_NET_PEER_NAME,
  ATTR_NET_HOST_NAME,
  ATTR_HTTP_METHOD,
  ATTR_NET_HOST_PORT,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_STATUS_TEXT,
  ATTR_HTTP_RES_STATUS_CODE,
  ATTR_HTTP_URL,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_ROUTE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_NET_PEER_PORT,
  ATTR_FULL_URL,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_URL_SCHEME
} = require('#agentlib/otel/constants.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    agent: helper.loadMockedAgent()
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('clientHost', () => {
  const span = {
    attributes: {
      [ATTR_NET_PEER_NAME]: 'example.com'
    }
  }
  const value = httpAttr({ key: 'clientHost', span })
  assert.deepEqual(value, 'example.com')
})

test('clientPort', () => {
  const span = {
    attributes: {
      [ATTR_NET_PEER_PORT]: 8080
    }
  }
  const value = httpAttr({ key: 'clientPort', span })
  assert.deepEqual(value, 8080)
})

test('clientUrl', () => {
  const span = {
    attributes: {
      [ATTR_HTTP_URL]: 'http://foobar.com/path?foo=bar&baz=bat'
    }
  }
  const value = httpAttr({ key: 'clientUrl', span })
  assert.deepEqual(value, 'http://foobar.com/path?foo=bar&baz=bat')
})

test('host', () => {
  const span = {
    attributes: {
      [ATTR_NET_HOST_NAME]: 'example.com'
    }
  }
  const value = httpAttr({ key: 'host', span })
  assert.deepEqual(value, 'example.com')
})

test('method', () => {
  const span = {
    attributes: {
      [ATTR_HTTP_METHOD]: 'GET'
    }
  }
  const value = httpAttr({ key: 'method', span })
  assert.deepEqual(value, 'GET')
})

test('port', () => {
  const span = {
    attributes: {
      [ATTR_NET_HOST_PORT]: 8080
    }
  }
  const value = httpAttr({ key: 'port', span })
  assert.deepEqual(value, 8080)
})

test('statusCode', () => {
  const span = {
    attributes: {
      [ATTR_HTTP_STATUS_CODE]: 200
    }
  }
  const value = httpAttr({ key: 'statusCode', span })
  assert.deepEqual(value, 200)
})

test('url', () => {
  const span = {
    attributes: {
      [ATTR_HTTP_URL]: 'https://www.server:port/path?q=p'
    }
  }
  let value = httpAttr({ key: 'url', span })
  assert.equal(value, 'https://www.server:port/path?q=p')
  delete span.attributes[ATTR_HTTP_URL]
  value = httpAttr({ key: 'url', span })
  assert.equal(value, 'https://unknown/unknown')
  span.attributes[ATTR_URL_SCHEME] = 'http'
  span.attributes[ATTR_SERVER_ADDRESS] = 'www.example.com'
  span.attributes[ATTR_URL_PATH] = '/path'
  value = httpAttr({ key: 'url', span })
  assert.equal(value, 'http://www.example.com/path')
  span.attributes[ATTR_SERVER_PORT] = 8080
  span.attributes[ATTR_URL_QUERY] = '?q=value&foo=bar'
  value = httpAttr({ key: 'url', span })
  assert.equal(value, 'http://www.example.com:8080/path?q=value&foo=bar')
})

test('clientMapper', (t) => {
  const { agent } = t.nr
  const span = {
    attributes: {
      [ATTR_HTTP_RES_STATUS_CODE]: 200,
      [ATTR_HTTP_STATUS_TEXT]: 'OK',
      [ATTR_SERVER_PORT]: 8080,
      [ATTR_SERVER_ADDRESS]: 'example.com',
      [ATTR_FULL_URL]: 'https://www.foobar.com:8080/path?q=p'
    }
  }

  const segment = {
    addAttribute: sinon.stub()
  }
  const mapper = clientMapper({ segment })
  const reconciler = new AttributeReconciler({ agent })
  reconciler.reconcile({ segment, otelSpan: span, mapper })
  assert.equal(segment.addAttribute.callCount, 2)
  const [statusCode, statusText] = segment.addAttribute.args
  assert.deepEqual(statusCode, ['http.statusCode', 200])
  assert.deepEqual(statusText, ['http.statusText', 'OK'])
})

test('serverMapper', (t) => {
  const { agent } = t.nr
  const span = {
    attributes: {
      [ATTR_HTTP_REQUEST_METHOD]: 'GET',
      [ATTR_HTTP_RES_STATUS_CODE]: 200,
      [ATTR_HTTP_STATUS_TEXT]: 'OK',
      [ATTR_SERVER_ADDRESS]: 'example.com',
      [ATTR_SERVER_PORT]: 8080,
      [ATTR_HTTP_ROUTE]: '/users/:userId',
    }
  }

  const segment = {
    addAttribute: sinon.stub()
  }
  const transaction = {
    nameState: {
      appendPath: sinon.stub()
    },
    trace: {
      attributes: {
        addAttribute: sinon.stub()
      }
    }
  }
  const mapper = serverMapper({ segment, transaction })
  const reconciler = new AttributeReconciler({ agent })
  reconciler.reconcile({ segment, otelSpan: span, mapper })
  assert.equal(transaction.statusCode, 200)
  assert.equal(transaction.nameState.appendPath.callCount, 1)
  assert.equal(transaction.nameState.appendPath.args[0], '/users/:userId')
  assert.equal(segment.addAttribute.callCount, 3)
  const [host, port, httpRoute] = segment.addAttribute.args
  assert.deepEqual(host, ['host', 'example.com'])
  assert.deepEqual(port, ['port', 8080])
  assert.deepEqual(httpRoute, ['http.route', '/users/:userId'])
  assert.equal(transaction.trace.attributes.addAttribute.callCount, 3)
  const [method, statusCode, statusText] = transaction.trace.attributes.addAttribute.args
  assert.deepEqual(method, [7, 'request.method', 'GET'])
  assert.deepEqual(statusCode, [7, 'http.statusCode', 200])
  assert.deepEqual(statusText, [7, 'http.statusText', 'OK'])
})

test('rpcMapper', (t) => {
  const { agent } = t.nr
  const span = {
    attributes: {
      [ATTR_GRPC_STATUS_CODE]: 0,
      [ATTR_RPC_METHOD]: 'TestService',
      [ATTR_RPC_SYSTEM]: 'grpc'
    }
  }

  const segment = {
    addAttribute: sinon.stub()
  }
  const transaction = {
    trace: {
      attributes: {
        addAttribute: sinon.stub()
      }
    }
  }
  const mapper = rpcMapper({ segment, transaction })
  const reconciler = new AttributeReconciler({ agent })
  reconciler.reconcile({ segment, otelSpan: span, mapper })
  assert.equal(segment.addAttribute.callCount, 2)
  const [statusCode, component] = segment.addAttribute.args
  assert.deepEqual(statusCode, ['rpc.grpc.status_code', 0])
  assert.deepEqual(component, ['component', 'grpc'])
  assert.equal(transaction.trace.attributes.addAttribute.callCount, 2)
  const [status, method] = transaction.trace.attributes.addAttribute.args
  assert.deepEqual(status, [7, 'response.status', 0])
  assert.deepEqual(method, [7, 'request.method', 'TestService'])
})
