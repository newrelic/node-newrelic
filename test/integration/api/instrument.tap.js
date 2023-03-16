/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')

test('should allow registering of multiple onRequire hooks', (t) => {

  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = './TestMod'
  api.instrument(moduleName, onRequire)
  api.instrument(moduleName, onRequire2)

  function onRequire(shim, TestMod) {
    shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
      return function wrappedFoo(...args) {
        args[0] = `${args[0]} in onRequire` 
        return orig.apply(this, args)
      }
    })
  }

  function onRequire2(shim, TestMod) {
    shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
      return function wrappedFoo(...args) {
        args[0] = `${args[0]} in onRequire2` 
        return orig.apply(this, args)
      }
    })
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
        return function wrappedFoo(...args) {
          args[0] = `${args[0]} in onRequire2` 
          return orig.apply(this, args)
        }
      })
    }
  } 

  const TestMod = require('./TestMod')

  const testMod = new TestMod()
  const ret = testMod.foo('this is orig arg')
  t.equal(ret, 'value of this is orig arg in onRequire2 in onRequire')
  t.end()
})

test('shim.unwrap should not break instrumentation registered after it', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = './TestMod'
  api.instrument(moduleName, onRequire)
  api.instrument(moduleName, onRequire2)

  function onRequire(shim, TestMod) {
    shim.unwrap(TestMod.prototype.foo)
  }

  function onRequire2(shim, TestMod) {
    shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
      return function wrappedFoo(...args) {
        args[0] = `${args[0]} in onRequire2` 
        return orig.apply(this, args)
      }
    })
  } 

  const TestMod = require('./TestMod')

  const testMod = new TestMod()
  const ret = testMod.foo('this is orig arg')
  t.equal(ret, 'value of this is orig arg in onRequire2')
  t.end()
})

test('shim.unwrap should not break instrumentation registered before it', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = './TestMod'
  api.instrument(moduleName, onRequire)
  api.instrument(moduleName, onRequire2)


  function onRequire(shim, TestMod) {
    shim.wrap(TestMod.prototype, 'foo', function wrapFoo(shim, orig) {
      return function wrappedFoo(...args) {
        args[0] = `${args[0]} in onRequire` 
        return orig.apply(this, args)
      }
    })
  } 
  
  function onRequire2(shim, TestMod) {
    shim.unwrap(TestMod.prototype.foo)
  }

  const TestMod = require('./TestMod')

  const testMod = new TestMod()
  const ret = testMod.foo('this is orig arg')
  t.equal(ret, 'value of this is orig arg in onRequire')
  t.end()
})
