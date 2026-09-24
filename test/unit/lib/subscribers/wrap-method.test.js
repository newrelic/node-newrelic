/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test } = require('node:test')
const {
  toggleUnwrappingTracking,
  unwrapAll,
  wrapMethod,
  wrapMethods
} = require('#agentlib/subscribers/wrap-method.js')
const { original, unwrap } = require('#agentlib/symbols.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    logs: {
      trace: [],
      debug: []
    }
  }
  ctx.nr.logger = {
    trace(...args) {
      ctx.nr.logs.trace.push(args)
    },
    debug(...args) {
      ctx.nr.logs.debug.push(args)
    }
  }
})

test.afterEach(() => {
  // `wrap-method.js` keeps a module-level list of wrapped methods and a
  // tracking flag. Drain the list and ensure tracking is left disabled so the
  // module state does not leak between tests.
  unwrapAll()
})

describe('wrapMethod', () => {
  test('replaces the method with the wrapper result', (t) => {
    const module = { greet: () => 'hello' }
    const originalMethod = module.greet

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper(orig) {
        return function wrapped(...args) {
          return orig.apply(this, args) + ' [wrapped]'
        }
      }
    })

    t.assert.notEqual(module.greet, originalMethod, 'method should be replaced')
    t.assert.equal(module.greet(), 'hello [wrapped]')
  })

  test('passes the original method and name to the wrapper', (t) => {
    const module = { greet: () => 'hello' }
    const originalMethod = module.greet
    let receivedOriginal
    let receivedName

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper(orig, name) {
        receivedOriginal = orig
        receivedName = name
        return orig
      }
    })

    t.assert.equal(receivedOriginal, originalMethod)
    t.assert.equal(receivedName, 'greet')
  })

  test('attaches original and unwrap symbols', (t) => {
    const module = { greet: () => 'hello' }
    const originalMethod = module.greet

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })

    t.assert.equal(module.greet[original], originalMethod, 'should point back at original')
    t.assert.equal(typeof module.greet[unwrap], 'function', 'should carry an unwrap closure')
  })

  test('unwrap symbol restores the original method', (t) => {
    const module = { greet: () => 'hello' }
    const originalMethod = module.greet

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })

    module.greet[unwrap]()
    t.assert.equal(module.greet, originalMethod, 'original should be restored')
  })

  test('copies enumerable own properties onto the wrapper', (t) => {
    const module = { greet: () => 'hello' }
    module.greet.decoration = 'decorated'

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => function wrapped() { return orig() }
    })

    t.assert.equal(module.greet.decoration, 'decorated')
  })

  test('does not wrap a method that is not defined', (t) => {
    const module = {}

    wrapMethod({
      module,
      methodName: 'missing',
      logger: t.nr.logger,
      wrapper: () => () => {}
    })

    t.assert.equal(module.missing, undefined)
    t.assert.deepStrictEqual(t.nr.logs.trace, [
      ['"%s" method is not defined on the provided module.', 'missing']
    ])
  })

  test('does not double-wrap an already wrapped method', (t) => {
    const module = { greet: () => 'hello' }

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })
    const firstWrap = module.greet

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })

    t.assert.equal(module.greet, firstWrap, 'should not be wrapped a second time')
    t.assert.deepStrictEqual(t.nr.logs.trace.at(-1), [
      '"%s" is already wrapped. Not wrapping again.',
      'greet'
    ])
  })
})

describe('wrapMethods', () => {
  test('wraps every named method', (t) => {
    const module = {
      foo: () => 'foo',
      bar: () => 'bar'
    }
    const originals = { foo: module.foo, bar: module.bar }

    wrapMethods({
      module,
      methodNames: ['foo', 'bar'],
      logger: t.nr.logger,
      wrapper: (orig, name) => () => `${orig()} ${name}`
    })

    t.assert.equal(module.foo(), 'foo foo')
    t.assert.equal(module.bar(), 'bar bar')
    t.assert.equal(module.foo[original], originals.foo)
    t.assert.equal(module.bar[original], originals.bar)
  })

  test('logs and skips a method that does not exist', (t) => {
    const module = { foo: () => 'foo' }

    wrapMethods({
      module,
      methodNames: ['foo', 'missing'],
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })

    t.assert.notEqual(module.foo[original], undefined, 'existing method still wrapped')
    t.assert.equal(module.missing, undefined)
    t.assert.deepStrictEqual(t.nr.logs.debug, [
      ['Cannot wrap "%s" because it does not exist on the object.', 'missing']
    ])
  })
})

describe('unwrap tracking', () => {
  test('does not track wrapped methods when tracking is disabled', (t) => {
    const module = { greet: () => 'hello' }

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })

    const wrapped = module.greet
    unwrapAll()
    t.assert.equal(module.greet, wrapped, 'unwrapAll should be a no-op when untracked')
  })

  test('unwrapAll restores tracked methods', (t) => {
    toggleUnwrappingTracking()
    t.after(() => {
      // leave tracking disabled for subsequent tests
      toggleUnwrappingTracking()
    })

    const module = { greet: () => 'hello' }
    const originalMethod = module.greet

    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })

    t.assert.notEqual(module.greet, originalMethod, 'method wrapped')
    unwrapAll()
    t.assert.equal(module.greet, originalMethod, 'method restored by unwrapAll')
  })

  test('unwrapAll restores every tracked method across modules', (t) => {
    toggleUnwrappingTracking()
    t.after(() => {
      toggleUnwrappingTracking()
    })

    const modA = { foo: () => 'foo' }
    const modB = { bar: () => 'bar' }
    const originalFoo = modA.foo
    const originalBar = modB.bar

    wrapMethod({ module: modA, methodName: 'foo', logger: t.nr.logger, wrapper: (orig) => () => orig() })
    wrapMethod({ module: modB, methodName: 'bar', logger: t.nr.logger, wrapper: (orig) => () => orig() })

    unwrapAll()

    t.assert.equal(modA.foo, originalFoo)
    t.assert.equal(modB.bar, originalBar)
  })

  test('toggleUnwrappingTracking flips tracking on and back off', (t) => {
    const module = { greet: () => 'hello' }
    const originalMethod = module.greet

    // First toggle enables tracking.
    toggleUnwrappingTracking()
    wrapMethod({
      module,
      methodName: 'greet',
      logger: t.nr.logger,
      wrapper: (orig) => () => orig()
    })
    const trackedWrap = module.greet

    // Second toggle disables tracking again.
    toggleUnwrappingTracking()
    const module2 = { greet: () => 'hi' }
    const untrackedWrap = wrapAndReturn(module2, t.nr.logger)

    unwrapAll()

    t.assert.equal(module.greet, originalMethod, 'tracked method was restored')
    t.assert.equal(module2.greet, untrackedWrap, 'untracked method was left wrapped')
    t.assert.notEqual(trackedWrap, originalMethod)
  })
})

function wrapAndReturn(module, logger) {
  wrapMethod({
    module,
    methodName: 'greet',
    logger,
    wrapper: (orig) => () => orig()
  })
  return module.greet
}
