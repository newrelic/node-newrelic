/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const specs = require('../../../../lib/instrumentation/fastify/spec-builders')
const WebFrameworkShim = require('../../../../lib/shim/webframework-shim')
const helper = require('../../../lib/agent_helper')

tap.test('Fastify spec builders', (t) => {
  let agent
  let shim
  t.before(() => {
    agent = helper.loadMockedAgent()
    shim = new WebFrameworkShim(agent, 'fastify-unit-test')
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.autoend()
  t.test('buildMiddlewareSpecForRouteHandler', (t) => {
    let mwSpec
    let bindStub
    t.before(() => {
      mwSpec = specs.buildMiddlewareSpecForRouteHandler(shim, '/path')
      bindStub = sinon.stub()
    })
    t.afterEach(() => {
      bindStub.resetHistory()
    })
    t.autoend()
    t.test('should return route from when original router function', (t) => {
      t.equal(mwSpec.route, '/path')
      t.end()
    })

    t.test('.next', (t) => {
      t.autoend()
      t.test('should not bind reply.send if not a function', (t) => {
        mwSpec.next(shim, 'fakeFn', 'fakeName', [null, 'not-a-fn'], bindStub)
        t.notOk(bindStub.callCount, 'should not call bindSegment')
        t.end()
      })
      t.test('should bind reply.send as final segment', (t) => {
        const replyStub = sinon.stub().returns({ send: sinon.stub() })
        mwSpec.next(shim, 'fakeFn', 'fakeName', [null, replyStub], bindStub)
        t.ok(bindStub.callCount, 'should call bindSegment')
        t.same(bindStub.args[0], [replyStub, 'send', true])
        t.end()
      })
    })

    t.test('.params', (t) => {
      t.autoend()
      t.test('should return params from request.params', (t) => {
        const request = { params: { key: 'value', user: 'id' } }
        const params = mwSpec.params(shim, 'fakeFn', 'fakeName', [request])
        t.same(params, request.params)
        t.end()
      })

      t.test('should not return params if request is undefined', (t) => {
        const params = mwSpec.params(shim, 'fakeFn', 'fakeName', [null])
        t.notOk(params)
        t.end()
      })
    })

    t.test('.req', (t) => {
      t.autoend()
      t.test('should return IncomingMessage from request.raw', (t) => {
        const request = { raw: 'IncomingMessage' }
        const req = mwSpec.req(shim, 'fakeFn', 'fakeName', [request])
        t.equal(req, request.raw)
        t.end()
      })

      t.test('should return IncomingMessage from request', (t) => {
        const request = 'IncomingMessage'
        const req = mwSpec.req(shim, 'fakeFn', 'fakeName', [request])
        t.equal(req, request)
        t.end()
      })
    })
  })
})
