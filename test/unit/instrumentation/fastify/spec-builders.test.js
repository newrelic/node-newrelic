/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const specs = require('../../../../lib/instrumentation/fastify/spec-builders')
const WebFrameworkShim = require('../../../../lib/shim/webframework-shim')
const helper = require('../../../lib/agent_helper')

test('Fastify spec builders', async (t) => {
  const agent = helper.loadMockedAgent()
  const shim = new WebFrameworkShim(agent, 'fastify-unit-test')

  t.after(() => {
    helper.unloadAgent(agent)
  })

  await t.test('buildMiddlewareSpecForRouteHandler', async (t) => {
    const mwSpec = specs.buildMiddlewareSpecForRouteHandler(shim, '/path')
    const bindStub = sinon.stub()

    t.afterEach(() => {
      bindStub.resetHistory()
    })

    await t.test('should return route from when original router function', (t, end) => {
      assert.equal(mwSpec.route, '/path')
      end()
    })

    await t.test('.next', async (t) => {
      await t.test('should not bind reply.send if not a function', (t, end) => {
        mwSpec.next(shim, 'fakeFn', 'fakeName', [null, 'not-a-fn'], bindStub)
        assert.ok(!bindStub.callCount, 'should not call bindSegment')
        end()
      })
      await t.test('should bind reply.send as final segment', (t, end) => {
        const replyStub = sinon.stub().returns({ send: sinon.stub() })
        mwSpec.next(shim, 'fakeFn', 'fakeName', [null, replyStub], bindStub)
        assert.ok(bindStub.callCount, 'should call bindSegment')
        assert.deepEqual(bindStub.args[0], [replyStub, 'send', true])
        end()
      })
    })

    await t.test('.params', async (t) => {
      await t.test('should return params from request.params', (t, end) => {
        const request = { params: { key: 'value', user: 'id' } }
        const params = mwSpec.params(shim, 'fakeFn', 'fakeName', [request])
        assert.deepEqual(params, request.params)
        end()
      })

      await t.test('should not return params if request is undefined', (t, end) => {
        const params = mwSpec.params(shim, 'fakeFn', 'fakeName', [null])
        assert.ok(!params)
        end()
      })
    })

    await t.test('.req', async (t) => {
      await t.test('should return IncomingMessage from request.raw', (t, end) => {
        const request = { raw: 'IncomingMessage' }
        const req = mwSpec.req(shim, 'fakeFn', 'fakeName', [request])
        assert.equal(req, request.raw)
        end()
      })

      await t.test('should return IncomingMessage from request', (t, end) => {
        const request = 'IncomingMessage'
        const req = mwSpec.req(shim, 'fakeFn', 'fakeName', [request])
        assert.equal(req, request)
        end()
      })
    })
  })
})
