/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const initialize = require('../../../../lib/instrumentation/koa/instrumentation')

tap.test('Koa instrumentation', (t) => {
  t.beforeEach((t) => {
    t.context.shimMock = {
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

    t.context.KoaMock = class {
      constructor() {
        this.use = sinon.stub()
        this.createContext = sinon.stub()
        this.emit = sinon.stub()
      }
    }
  })

  t.test('should work with Koa MJS export', async (t) => {
    const { shimMock, KoaMock } = t.context

    initialize(shimMock, { default: KoaMock })
    t.equal(shimMock.logger.debug.callCount, 0, 'should not have called debug')
    t.ok(shimMock.setFramework.calledOnceWith('koa'), 'should set the framework')
    t.ok(shimMock.wrapMiddlewareMounter.calledOnceWith(KoaMock.prototype, 'use'), 'should wrap use')
    t.ok(
      shimMock.wrapReturn.calledOnceWith(KoaMock.prototype, 'createContext'),
      'should wrap createContext'
    )
    t.ok(shimMock.wrap.calledOnceWith(KoaMock.prototype, 'emit'), 'should wrap emit')
  })

  t.test('should log when unable to find the prototype MJS Export', async (t) => {
    const { shimMock } = t.context

    initialize(shimMock, { default: {} })
    t.ok(
      shimMock.logger.debug.calledOnceWith(
        'Koa instrumentation function called with incorrect arguments, not instrumenting.'
      ),
      'should have called debug'
    )
  })

  t.test('should work with Koa CJS export', async (t) => {
    const { shimMock, KoaMock } = t.context

    initialize(shimMock, KoaMock)
    t.equal(shimMock.logger.debug.callCount, 0, 'should not have called debug')
    t.ok(shimMock.setFramework.calledOnceWith('koa'), 'should set the framework')
    t.ok(shimMock.wrapMiddlewareMounter.calledOnceWith(KoaMock.prototype, 'use'), 'should wrap use')
    t.ok(
      shimMock.wrapReturn.calledOnceWith(KoaMock.prototype, 'createContext'),
      'should wrap createContext'
    )
    t.ok(shimMock.wrap.calledOnceWith(KoaMock.prototype, 'emit'), 'should wrap emit')
  })

  t.test('should log when unable to find the prototype CJS Export', async (t) => {
    const { shimMock } = t.context

    initialize(shimMock, {})
    t.ok(
      shimMock.logger.debug.calledOnceWith(
        'Koa instrumentation function called with incorrect arguments, not instrumenting.'
      ),
      'should have called debug'
    )
  })

  t.end()
})
