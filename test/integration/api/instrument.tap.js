/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')
const sinon = require('sinon')

test('should allow registering of multiple onRequire hooks', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    delete require.cache[require.resolve('./TestMod')]
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = './TestMod'
  api.instrument(moduleName, onRequire)
  api.instrument(moduleName, onRequire2)
  let firstShim
  let secondShim

  function onRequire(shim, TestMod) {
    firstShim = shim
    shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
      t.notOk(shim.isWrapped(orig))
      return function wrappedFoo(...args) {
        t.ok(secondShim.isWrapped(TestMod.prototype.foo))
        args[0] = `${args[0]} in onRequire`
        return orig.apply(this, args)
      }
    })
    t.ok(shim.isWrapped(TestMod.prototype.foo))
  }

  function onRequire2(shim, TestMod) {
    secondShim = shim
    shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
      t.ok(firstShim.isWrapped(orig))
      t.notOk(shim.isWrapped(TestMod.prototype.foo))
      return function wrappedFoo2(...args) {
        t.ok(shim.isWrapped(TestMod.prototype.foo))
        args[0] = `${args[0]} in onRequire2`
        return orig.apply(this, args)
      }
    })
    t.ok(shim.isWrapped(TestMod.prototype.foo))
  }

  const TestMod = require('./TestMod')

  const testMod = new TestMod()
  const ret = testMod.foo('this is orig arg')
  t.equal(ret, 'value of this is orig arg in onRequire2 in onRequire')
  t.end()
})

test('should allow checking for isWrapped relevant to the wrapping you are about to do', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    delete require.cache[require.resolve('./TestMod')]
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = './TestMod'
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

  const TestMod = require('./TestMod')

  const testMod = new TestMod()
  const ret = testMod.foo('this is orig arg')
  require('./TestMod')
  t.equal(ret, 'value of this is orig arg in onRequire2 in onRequire')
  t.end()
})

test('shim.unwrap should not break instrumentation registered after it', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    delete require.cache[require.resolve('./TestMod')]
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = './TestMod'
  api.instrument(moduleName, onRequire)

  function onRequire(shim, TestMod) {
    shim.wrap(TestMod.prototype, 'foo', function wrapStuff(shim, orig) {
      return function wrapped1(...args) {
        shim.unwrap(TestMod.prototype, 'foo')
        return orig.apply(this, args)
      }
    })
  }

  const TestMod = require('./TestMod')

  const testMod = new TestMod()
  const ret = testMod.foo('Hello world')
  t.equal(ret, 'value of Hello world')
  const shim = TestMod[symbols.shim]
  t.notOk(shim.isWrapped(TestMod.prototype.foo), 'should unwrap as expected')
  t.end()
})

test('shim.unwrap should not log warning if you try to unwrap and it has been wrapped more than once', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    delete require.cache[require.resolve('./TestMod')]
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = './TestMod'
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

  const TestMod = require('./TestMod')
  const loggerSpy1 = sinon.spy(shim1.logger, 'warn')
  const loggerSpy2 = sinon.spy(shim2.logger, 'warn')

  const testMod = new TestMod()
  testMod.foo('this is orig arg')
  testMod.foo('this is call 2')
  t.ok(shim2.isWrapped(TestMod.prototype.foo), 'should unwrap as expected')
  ;[loggerSpy1, loggerSpy2].forEach((spy) => {
    t.equal(
      spy.args[0][0],
      'Attempting to unwrap %s, which its unwrapped version is also wrapped. This is unsupported, unwrap will not occur.'
    )
    t.equal(spy.args[0][1], 'foo')
  })
  t.end()
})
