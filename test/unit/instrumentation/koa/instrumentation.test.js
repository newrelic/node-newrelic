/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const initialize = require('../../../../lib/instrumentation/koa/instrumentation')

test('Koa instrumentation', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.shimMock = {
      KOA: 'koa',
      MIDDLEWARE: 'middleware',
      logger: {
        debug: sinon.stub(),
        info: sinon.stub()
      },
      specs: {
        MiddlewareMounterSpec: sinon.stub(),
        MiddlewareSpec: sinon.stub()
      },
      setFramework: sinon.stub(),
      wrapMiddlewareMounter: sinon.stub(),
      wrapReturn: sinon.stub(),
      wrap: sinon.stub(),
      savePossibleTransactionName: sinon.stub()
    }

    ctx.nr.KoaMock = class {
      constructor() {
        this.use = sinon.stub()
        this.createContext = sinon.stub()
        this.emit = sinon.stub()
      }
    }
  })

  await t.test('should work with Koa MJS export', async (t) => {
    const { shimMock, KoaMock } = t.nr

    initialize(shimMock, { default: KoaMock })
    assert.equal(shimMock.logger.debug.callCount, 0, 'should not have called debug')
    assert.ok(shimMock.setFramework.calledOnceWith('koa'), 'should set the framework')
    assert.ok(
      shimMock.wrapMiddlewareMounter.calledOnceWith(KoaMock.prototype, 'use'),
      'should wrap use'
    )
    assert.ok(
      shimMock.wrapReturn.calledOnceWith(KoaMock.prototype, 'createContext'),
      'should wrap createContext'
    )
    assert.ok(shimMock.wrap.calledOnceWith(KoaMock.prototype, 'emit'), 'should wrap emit')
  })

  await t.test('should log when unable to find the prototype MJS Export', async (t) => {
    const { shimMock } = t.nr

    initialize(shimMock, { default: {} })
    assert.ok(
      shimMock.logger.debug.calledOnceWith(
        'Koa instrumentation function called with incorrect arguments, not instrumenting.'
      ),
      'should have called debug'
    )
  })

  await t.test('should work with Koa CJS export', async (t) => {
    const { shimMock, KoaMock } = t.nr

    initialize(shimMock, KoaMock)
    assert.equal(shimMock.logger.debug.callCount, 0, 'should not have called debug')
    assert.ok(shimMock.setFramework.calledOnceWith('koa'), 'should set the framework')
    assert.ok(
      shimMock.wrapMiddlewareMounter.calledOnceWith(KoaMock.prototype, 'use'),
      'should wrap use'
    )
    assert.ok(
      shimMock.wrapReturn.calledOnceWith(KoaMock.prototype, 'createContext'),
      'should wrap createContext'
    )
    assert.ok(shimMock.wrap.calledOnceWith(KoaMock.prototype, 'emit'), 'should wrap emit')
  })

  await t.test('should log when unable to find the prototype CJS Export', async (t) => {
    const { shimMock } = t.nr

    initialize(shimMock, {})
    assert.ok(
      shimMock.logger.debug.calledOnceWith(
        'Koa instrumentation function called with incorrect arguments, not instrumenting.'
      ),
      'should have called debug'
    )
  })
})
