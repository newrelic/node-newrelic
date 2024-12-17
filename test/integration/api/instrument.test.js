/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')
const sinon = require('sinon')
const moduleName = 'TestMod'
const modulePath = './node_modules/TestMod'

test('instrument', async (t) => {
  t.beforeEach((ctx) => {
    const agent = agentHelper.instrumentMockedAgent()
    const api = new API(agent)
    ctx.nr = {
      agent,
      api
    }
  })

  t.afterEach((ctx) => {
    const mod = require.resolve(modulePath)
    delete require.cache[mod]
    agentHelper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should allow registering of multiple onRequire hooks', (t, end) => {
    const { api } = t.nr
    api.instrument(moduleName, onRequire)
    api.instrument(moduleName, onRequire2)
    let firstShim
    let secondShim

    function onRequire(shim, TestMod) {
      firstShim = shim
      shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
        assert.ok(!shim.isWrapped(orig))
        return function wrappedFoo(...args) {
          assert.ok(secondShim.isWrapped(TestMod.prototype.foo))
          args[0] = `${args[0]} in onRequire`
          return orig.apply(this, args)
        }
      })
      assert.ok(shim.isWrapped(TestMod.prototype.foo))
    }

    function onRequire2(shim, TestMod) {
      secondShim = shim
      shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
        assert.ok(firstShim.isWrapped(orig))
        assert.ok(!shim.isWrapped(TestMod.prototype.foo))
        return function wrappedFoo2(...args) {
          assert.ok(shim.isWrapped(TestMod.prototype.foo))
          args[0] = `${args[0]} in onRequire2`
          return orig.apply(this, args)
        }
      })
      assert.ok(shim.isWrapped(TestMod.prototype.foo))
    }

    const TestMod = require(modulePath)

    const testMod = new TestMod()
    const ret = testMod.foo('this is orig arg')
    assert.equal(ret, 'value of this is orig arg in onRequire2 in onRequire')
    end()
  })

  await t.test(
    'should allow checking for isWrapped relevant to the wrapping you are about to do',
    (t, end) => {
      const { api } = t.nr
      api.instrument(moduleName, onRequire)
      api.instrument(moduleName, onRequire2)

      function onRequire(shim, TestMod) {
        const isWrapped = shim.isWrapped(TestMod.prototype.foo)
        if (!isWrapped) {
          shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
            return function wrappedFoo(...args) {
              args[0] = `${args[0]} in onRequire`
              return orig.apply(this, args)
            }
          })
        }
      }

      function onRequire2(shim, TestMod) {
        const isWrapped = shim.isWrapped(TestMod.prototype.foo)
        if (!isWrapped) {
          shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
            return function wrappedFoo2(...args) {
              args[0] = `${args[0]} in onRequire2`
              return orig.apply(this, args)
            }
          })
        }
      }

      const TestMod = require(modulePath)

      const testMod = new TestMod()
      const ret = testMod.foo('this is orig arg')
      require(modulePath)
      assert.equal(ret, 'value of this is orig arg in onRequire2 in onRequire')
      end()
    }
  )

  await t.test('shim.unwrap should not break instrumentation registered after it', (t, end) => {
    const { api } = t.nr
    api.instrument(moduleName, onRequire)

    function onRequire(shim, TestMod) {
      shim.wrap(TestMod.prototype, 'foo', function wrapStuff(shim, orig) {
        return function wrapped1(...args) {
          shim.unwrap(TestMod.prototype, 'foo')
          return orig.apply(this, args)
        }
      })
    }

    const TestMod = require(modulePath)

    const testMod = new TestMod()
    const ret = testMod.foo('Hello world')
    assert.equal(ret, 'value of Hello world')
    const shim = TestMod[symbols.shim]
    assert.ok(!shim.isWrapped(TestMod.prototype.foo), 'should unwrap as expected')
    end()
  })

  await t.test(
    'shim.unwrap should not log warning if you try to unwrap and it has been wrapped more than once',
    (t, end) => {
      const { api } = t.nr
      api.instrument(moduleName, onRequire)
      api.instrument(moduleName, onRequire2)
      let shim1
      let shim2

      function onRequire(shim, TestMod) {
        shim1 = shim
        shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
          return function wrapped1(...args) {
            shim.unwrap(TestMod.prototype, 'foo')
            return orig.apply(this, args)
          }
        })
      }

      function onRequire2(shim, TestMod) {
        shim2 = shim
        shim.wrap(TestMod.prototype, 'foo', function wrapStuff(shim, orig) {
          return function wrapped2(...args) {
            shim.unwrap(TestMod.prototype, 'foo')
            return orig.apply(this, args)
          }
        })
      }

      const TestMod = require(modulePath)
      const loggerSpy1 = sinon.spy(shim1.logger, 'warn')
      const loggerSpy2 = sinon.spy(shim2.logger, 'warn')

      const testMod = new TestMod()
      testMod.foo('this is orig arg')
      testMod.foo('this is call 2')
      assert.ok(shim2.isWrapped(TestMod.prototype.foo), 'should unwrap as expected')
      ;[loggerSpy1, loggerSpy2].forEach((spy) => {
        assert.equal(
          spy.args[0][0],
          'Attempting to unwrap %s, which its unwrapped version is also wrapped. This is unsupported, unwrap will not occur.'
        )
        assert.equal(spy.args[0][1], 'foo')
      })
      end()
    }
  )
})
