/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { EventEmitter } = require('events')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')
const symbols = require('../../../lib/symbols')
const { RecorderSpec } = require('../../../lib/shim/specs')
const {
  checkWrappedCb,
  checkNotWrappedCb,
  compareSegments,
  isNonWritable
} = require('../../lib/custom-assertions')
const promiseResolvers = require('../../lib/promise-resolvers')
const { tspl } = require('@matteo.collina/tspl')
const tempOverrideUncaught = require('../../lib/temp-override-uncaught')

test('Shim', async function (t) {
  function beforeEach(ctx) {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.tracer = helper.getTracer()
    ctx.nr.shim = new Shim(agent, 'test-module')
    ctx.nr.wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' },
      fiz: function fizsName() {
        return 'fiz'
      },
      anony: function () {},
      getActiveSegment: function () {
        return ctx.nr.tracer.getSegment()
      }
    }
    ctx.nr.agent = agent
  }

  function afterEach(ctx) {
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('constructor', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should require an agent parameter', function () {
      assert.throws(function () {
        return new Shim()
      })
    })

    await t.test('should require a module name parameter', function (t) {
      const { agent } = t.nr
      assert.throws(function () {
        return new Shim(agent)
      })
    })

    await t.test('should assign properties from parent', (t) => {
      const { agent } = t.nr
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new Shim(agent, mod, mod, name, version)
      assert.equal(shim.moduleName, mod)
      assert.equal(agent, shim._agent)
      assert.equal(shim.pkgVersion, version)
    })
  })

  await t.test('.defineProperty', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should create a non-writable property', function () {
      const foo = {}
      Shim.defineProperty(foo, 'bar', 'foobar')
      assert.equal(foo.bar, 'foobar')
      isNonWritable({ obj: foo, key: 'bar', value: 'foobar' })
    })

    await t.test('should create a getter', function () {
      const foo = {}
      let getterCalled = false
      Shim.defineProperty(foo, 'bar', function () {
        getterCalled = true
        return 'foobar'
      })

      assert.equal(getterCalled, false)
      assert.equal(foo.bar, 'foobar')
      assert.equal(getterCalled, true)
    })
  })

  await t.test('.defineProperties', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should create all the properties specified', function () {
      const foo = {}
      Shim.defineProperties(foo, {
        bar: 'foobar',
        fiz: function () {
          return 'bang'
        }
      })

      assert.deepEqual(Object.keys(foo), ['bar', 'fiz'])
    })
  })

  await t.test('#FIRST through #LAST', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    const keys = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST']

    let i = 0
    for (const key of keys) {
      await t.test(`${key} should be a non-writable property`, function (t) {
        const { shim } = t.nr
        isNonWritable({ obj: shim, key })
      })

      await t.test(`${key} should be an array index value`, function (t) {
        const { shim } = t.nr
        assert.equal(shim[key], key === 'LAST' ? -1 : i)
      })
      i++
    }
  })

  await t.test('#agent', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should be a non-writable property', function (t) {
      const { agent, shim } = t.nr
      isNonWritable({ obj: shim, key: 'agent', value: agent })
    })

    await t.test('should be the agent handed to the constructor', function () {
      const foo = {}
      const s = new Shim(foo, 'test-module')
      assert.equal(s.agent, foo)
    })
  })

  await t.test('#tracer', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should be a non-writable property', function (t) {
      const { agent, shim } = t.nr
      isNonWritable({ obj: shim, key: 'tracer', value: agent.tracer })
    })

    await t.test('should be the tracer from the agent', function () {
      const foo = { tracer: {} }
      const s = new Shim(foo, 'test-module')
      assert.equal(s.tracer, foo.tracer)
    })
  })

  await t.test('#moduleName', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should be a non-writable property', function (t) {
      const { shim } = t.nr
      isNonWritable({ obj: shim, key: 'moduleName', value: 'test-module' })
    })

    await t.test('should be the name handed to the constructor', function (t) {
      const { agent } = t.nr
      const s = new Shim(agent, 'some-module-name')
      assert.equal(s.moduleName, 'some-module-name')
    })
  })

  await t.test('#logger', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should be a non-writable property', function (t) {
      const { shim } = t.nr
      isNonWritable({ obj: shim, key: 'logger' })
    })

    await t.test('should be a logger to use with the shim', function (t) {
      const { shim } = t.nr
      assert.ok(shim.logger.trace instanceof Function)
      assert.ok(shim.logger.debug instanceof Function)
      assert.ok(shim.logger.info instanceof Function)
      assert.ok(shim.logger.warn instanceof Function)
      assert.ok(shim.logger.error instanceof Function)
    })
  })

  await t.test('#wrap', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should call the spec with the to-be-wrapped item', function (t, end) {
      const { shim, wrappable } = t.nr
      shim.wrap(wrappable, function (_shim, toWrap, name) {
        assert.equal(_shim, shim)
        assert.equal(toWrap, wrappable)
        assert.equal(name, wrappable.name)
        end()
      })
    })

    await t.test('should match the arity and name of the original when specified', function (t) {
      const { shim } = t.nr

      function toWrap(a, b) {}
      const wrapped = shim.wrap(toWrap, {
        wrapper: function () {
          return function wrappedFn() {}
        },
        matchArity: true
      })
      assert.notEqual(wrapped, toWrap)
      assert.equal(wrapped.length, toWrap.length)
      assert.equal(wrapped.name, toWrap.name)
    })

    await t.test('should pass items in the `args` parameter to the spec', function (t, end) {
      const { shim, wrappable } = t.nr
      shim.wrap(
        wrappable,
        function (_shim, toWrap, name, arg1, arg2, arg3) {
          assert.equal(arguments.length, 6)
          assert.equal(arg1, 'a')
          assert.equal(arg2, 'b')
          assert.equal(arg3, 'c')
          end()
        },
        ['a', 'b', 'c']
      )
    })

    await t.test('should wrap the first parameter', function (t, end) {
      const { shim, wrappable } = t.nr
      shim.wrap(wrappable, function (_, toWrap) {
        assert.equal(toWrap, wrappable)
        end()
      })
    })

    await t.test('should wrap the first parameter when properties is `null`', function (t, end) {
      const { shim, wrappable } = t.nr
      shim.wrap(wrappable, null, function (_, toWrap) {
        assert.equal(toWrap, wrappable)
        end()
      })
    })

    await t.test('should mark the first parameter as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrap(wrappable, function (_, toWrap) {
        return { wrappable: toWrap }
      })

      assert.notEqual(wrapped, wrappable)
      assert.equal(wrapped.wrappable, wrappable)
      assert.equal(shim.isWrapped(wrapped), true)
    })
  })

  await t.test('#wrap with properties', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { shim } = ctx.nr
      const barTestWrapper = function () {}
      ctx.nr.originalBar = ctx.nr.wrappable.bar
      ctx.nr.ret = shim.wrap(ctx.nr.wrappable, 'bar', function () {
        return barTestWrapper
      })
    })

    t.afterEach(afterEach)

    await t.test('should accept a single property', function (t) {
      const { ret, shim, wrappable } = t.nr
      const originalFiz = wrappable.fiz
      shim.wrap(wrappable, 'fiz', function (_, toWrap, name) {
        assert.equal(toWrap, wrappable.fiz)
        assert.equal(name, 'fiz', 'should use property as name')
      })

      assert.equal(ret, wrappable)
      assert.equal(wrappable.fiz, originalFiz, 'should not replace unwrapped')
    })

    await t.test('should accept an array of properties', function (t) {
      const { shim, wrappable } = t.nr
      let specCalled = 0
      shim.wrap(wrappable, ['fiz', 'anony'], function (_, toWrap, name) {
        ++specCalled
        if (specCalled === 1) {
          assert.equal(toWrap, wrappable.fiz)
          assert.equal(name, 'fiz')
        } else if (specCalled === 2) {
          assert.equal(toWrap, wrappable.anony)
          assert.equal(name, 'anony')
        }
      })

      assert.equal(specCalled, 2)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { originalBar, wrappable } = t.nr
      assert.notEqual(wrappable.bar, originalBar)
    })

    await t.test('should mark wrapped properties as such', function (t) {
      const { shim, originalBar, wrappable } = t.nr
      assert.notEqual(wrappable.bar, originalBar)
      assert.equal(shim.isWrapped(wrappable, 'bar'), true)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      assert.equal(shim.isWrapped(wrappable, 'fiz'), false)
    })
  })

  await t.test('with a function', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const wrapper = function wrapperFunc() {
        return function wrapped() {}
      }
      ctx.nr.shim.wrap(ctx.nr.wrappable, 'bar', wrapper)
    })

    t.afterEach(afterEach)

    await t.test('should not maintain the name', function (t) {
      const { wrappable } = t.nr
      assert.equal(wrappable.bar.name, 'wrapped')
    })

    await t.test('should not maintain the arity', function (t) {
      const { wrappable } = t.nr
      assert.equal(wrappable.bar.length, 0)
    })
  })

  await t.test('#bindSegment', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)

      ctx.nr.segment = {
        started: false,
        touched: false,
        probed: false,
        start: function () {
          this.started = true
        },
        touch: function () {
          this.touched = true
        },
        probe: function () {
          this.probed = true
        }
      }

      ctx.nr.startingSegment = ctx.nr.tracer.getSegment()
    })

    t.afterEach(afterEach)

    await t.test('should not wrap non-functions', function (t) {
      const { shim, wrappable } = t.nr
      shim.bindSegment(wrappable, 'name')
      assert.equal(shim.isWrapped(wrappable, 'name'), false)
    })

    await t.test('should not error if `nodule` is `null`', function (t) {
      const { segment, shim } = t.nr
      assert.doesNotThrow(function () {
        shim.bindSegment(null, 'foobar', segment)
      })
    })

    await t.test('should wrap the first parameter if `property` is not given', function (t) {
      const { segment, shim, wrappable } = t.nr
      const wrapped = shim.bindSegment(wrappable.getActiveSegment, segment)

      assert.notEqual(wrapped, wrappable.getActiveSegment)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.getActiveSegment)
    })

    await t.test('should wrap the first parameter if `property` is `null`', function (t) {
      const { segment, shim, wrappable } = t.nr
      const wrapped = shim.bindSegment(wrappable.getActiveSegment, null, segment)

      assert.notEqual(wrapped, wrappable.getActiveSegment)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.getActiveSegment)
    })

    await t.test('should not wrap the function at all with no segment', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.bindSegment(wrappable.getActiveSegment)
      assert.equal(wrapped, wrappable.getActiveSegment)
      assert.equal(shim.isWrapped(wrapped), false)
    })

    await t.test('should be safe to pass a full param with not segment', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.bindSegment(wrappable.getActiveSegment, null, true)
      assert.equal(wrapped, wrappable.getActiveSegment)
      assert.equal(shim.isWrapped(wrapped), false)
      assert.doesNotThrow(wrapped)
    })

    await t.test('should make the given segment active while executing', function (t) {
      const { tracer, segment, shim, startingSegment, wrappable } = t.nr
      assert.notEqual(startingSegment, segment, 'test should start in clean condition')

      shim.bindSegment(wrappable, 'getActiveSegment', segment)
      assert.equal(tracer.getSegment(), startingSegment)
      assert.equal(wrappable.getActiveSegment(), segment)
      assert.equal(tracer.getSegment(), startingSegment)
    })

    await t.test('should not require any arguments except a function', function (t) {
      const { tracer, segment, shim, startingSegment, wrappable } = t.nr
      assert.notEqual(startingSegment, segment, 'test should start in clean condition')

      // bindSegment will not wrap if there is no segment active and
      // no segment is passed in.  To get around this we set the
      // active segment to an object known not to be null then do the
      // wrapping.
      tracer.setSegment(segment)
      const wrapped = shim.bindSegment(wrappable.getActiveSegment)
      tracer.setSegment(startingSegment)

      assert.equal(wrapped(), segment)
      assert.equal(tracer.getSegment(), startingSegment)
    })

    await t.test('should default `full` to false', function (t) {
      const { segment, shim, wrappable } = t.nr
      shim.bindSegment(wrappable, 'getActiveSegment', segment)
      wrappable.getActiveSegment()

      assert.equal(segment.started, false)
      assert.equal(segment.touched, false)
    })

    await t.test('should start and touch the segment if `full` is `true`', function (t) {
      const { segment, shim, wrappable } = t.nr
      shim.bindSegment(wrappable, 'getActiveSegment', segment, true)
      wrappable.getActiveSegment()

      assert.equal(segment.started, true)
      assert.equal(segment.touched, true)
    })

    await t.test('should default to the current segment', function (t) {
      const { tracer, segment, shim, wrappable } = t.nr
      tracer.setSegment(segment)
      shim.bindSegment(wrappable, 'getActiveSegment')
      const activeSegment = wrappable.getActiveSegment()
      assert.equal(activeSegment, segment)
    })
  })

  await t.test('#wrapReturn', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      shim.wrapReturn(wrappable, 'name', function () {})
      assert.equal(shim.isWrapped(wrappable, 'name'), false)
    })

    await t.test('should not blow up when wrapping a non-object prototype', function (t) {
      const { shim } = t.nr
      function noProto() {}
      noProto.prototype = undefined
      const instance = shim.wrapReturn(noProto, function () {}).bind({})
      assert.doesNotThrow(instance)
    })

    await t.test(
      'should not blow up when wrapping a non-object prototype, null bind',
      function (t) {
        const { shim } = t.nr
        function noProto() {}
        noProto.prototype = undefined
        const instance = shim.wrapReturn(noProto, function () {}).bind(null)
        assert.doesNotThrow(instance)
      }
    )

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrapReturn(wrappable.bar, function () {})

      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrapReturn(wrappable.bar, null, function () {})

      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.wrapReturn(wrappable, 'bar', function () {})

      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable, 'bar'), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should wrap child instance properly', function (t) {
      const { shim } = t.nr
      class ParentTest {
        constructor() {
          this.parent = true
        }

        parentMethod() {
          return 'hello world'
        }
      }

      const WrappedParent = shim.wrapReturn(ParentTest, function () {})

      class ChildTest extends WrappedParent {
        childMethod() {
          return 'child method'
        }
      }

      const child = new ChildTest()
      assert.equal(typeof child.childMethod, 'function', 'should have child methods')
      assert.equal(typeof child.parentMethod, 'function', 'should have parent methods')
    })
  })

  await t.test('#wrapReturn wrapper', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { shim } = ctx.nr
      ctx.nr.executed = false
      ctx.nr.toWrap = {
        foo: function () {
          ctx.nr.executed = true
          ctx.nr.returned = {
            context: this,
            args: shim.toArray(arguments)
          }
          return ctx.nr.returned
        }
      }
    })
    t.afterEach(afterEach)

    await t.test('should execute the wrapped function', function (t) {
      const { shim, toWrap } = t.nr
      shim.wrapReturn(toWrap, 'foo', function () {})
      const res = toWrap.foo('a', 'b', 'c')
      assert.equal(t.nr.executed, true)
      assert.equal(res.context, toWrap)
      assert.deepEqual(res.args, ['a', 'b', 'c'])
    })

    await t.test('should pass properties through', function (t) {
      const { shim, toWrap } = t.nr
      const original = toWrap.foo
      original.testSymbol = Symbol('test')
      shim.wrapReturn(toWrap, 'foo', function () {})

      // wrapper is not the same function reference
      assert.notEqual(original, toWrap.foo)
      // set on original
      assert.equal(toWrap.foo.testSymbol, original.testSymbol)
    })

    await t.test('should pass assignments to the wrapped method', function (t) {
      const { shim, toWrap } = t.nr
      const original = toWrap.foo
      shim.wrapReturn(toWrap, 'foo', function () {})
      toWrap.foo.testProp = 1

      // wrapper is not the same function reference
      assert.notEqual(original, toWrap.foo)
      // set via wrapper
      assert.equal(original.testProp, 1)
    })

    await t.test('should pass defined properties to the wrapped method', function (t) {
      const { shim, toWrap } = t.nr
      const original = toWrap.foo
      shim.wrapReturn(toWrap, 'foo', function () {})
      Object.defineProperty(toWrap.foo, 'testDefProp', { value: 4 })

      // wrapper is not the same function reference
      assert.notEqual(original, toWrap.foo)
      // set with defineProperty via wrapper
      assert.equal(original.testDefProp, 4)
    })

    await t.test('should have the same key enumeration', function (t) {
      const { shim, toWrap } = t.nr
      const original = toWrap.foo
      original.testSymbol = Symbol('test')
      shim.wrapReturn(toWrap, 'foo', function () {})
      toWrap.foo.testProp = 1

      // wrapper is not the same function reference
      assert.notEqual(original, toWrap.foo)
      // should have the same keys
      assert.deepEqual(Object.keys(original), Object.keys(toWrap.foo))
    })

    await t.test('should call the spec with returned value', function (t) {
      const { shim, toWrap } = t.nr
      let specExecuted = false
      shim.wrapReturn(toWrap, 'foo', function (_, fn, name, ret) {
        specExecuted = true
        assert.equal(ret, t.nr.returned)
      })

      toWrap.foo()
      assert.equal(specExecuted, true)
    })

    await t.test(
      'should invoke the spec in the context of the wrapped function',
      function (t, end) {
        const { shim, toWrap } = t.nr
        shim.wrapReturn(toWrap, 'foo', function () {
          assert.equal(this, toWrap)
          end()
        })

        toWrap.foo()
      }
    )

    await t.test('should invoke the spec with `new` if itself is invoked with `new`', function (t) {
      const { shim } = t.nr
      function Foo() {
        assert.equal(this instanceof Foo, true)
      }

      Foo.prototype.method = function () {}
      const WrappedFoo = shim.wrapReturn(Foo, function () {
        assert.equal(this instanceof Foo, true)
      })

      const foo = new WrappedFoo()
      assert.equal(foo instanceof Foo, true)
      assert.equal(foo instanceof WrappedFoo, true)
      assert.equal(typeof foo.method, 'function')
    })

    await t.test('should pass items in the `args` parameter to the spec', function (t, end) {
      const { shim, toWrap } = t.nr

      shim.wrapReturn(
        toWrap,
        'foo',
        function (_, fn, name, ret, a, b, c) {
          assert.equal(arguments.length, 7)
          assert.equal(a, 'a')
          assert.equal(b, 'b')
          assert.equal(c, 'c')
          end()
        },
        ['a', 'b', 'c']
      )

      toWrap.foo()
    })
  })

  await t.test('#wrapClass', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      shim.wrapClass(wrappable, 'name', function () {})
      assert.equal(shim.isWrapped(wrappable, 'name'), false)
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrapClass(wrappable.bar, function () {})

      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrapClass(wrappable.bar, null, function () {})

      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.wrapClass(wrappable, 'bar', function () {})

      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable, 'bar'), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })
  })

  await t.test('#wrapClass wrapper', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { shim } = ctx.nr
      ctx.nr.executed = false
      const toWrap = {
        Foo: function () {
          this.executed = ctx.nr.executed = true
          this.context = this
          this.args = shim.toArray(arguments)
        }
      }
      ctx.nr.original = toWrap.Foo
      ctx.nr.toWrap = toWrap
    })
    t.afterEach(afterEach)

    await t.test('should execute the wrapped function', function (t) {
      const { shim, toWrap } = t.nr
      shim.wrapClass(toWrap, 'Foo', function () {})
      const res = new toWrap.Foo('a', 'b', 'c')
      assert.equal(t.nr.executed, true)
      assert.equal(res.context, res)
      assert.deepEqual(res.args, ['a', 'b', 'c'])
    })

    await t.test('should call the hooks in the correct order', function (t) {
      const { original, shim, toWrap } = t.nr
      let preExecuted = false
      let postExecuted = false
      shim.wrapClass(toWrap, 'Foo', {
        pre: function () {
          preExecuted = true
          assert.equal(this, undefined)
        },
        post: function () {
          postExecuted = true
          assert.equal(this.executed, true)
          assert.equal(this instanceof toWrap.Foo, true)
          assert.equal(this instanceof original, true)
        }
      })

      const foo = new toWrap.Foo()
      assert.equal(preExecuted, true)
      assert.equal(foo.executed, true)
      assert.equal(postExecuted, true)
    })

    await t.test('should pass items in the `args` parameter to the spec', function (t) {
      const { shim, toWrap } = t.nr

      shim.wrapClass(
        toWrap,
        'Foo',
        function (_, fn, name, args, a, b, c) {
          assert.equal(arguments.length, 7)
          assert.equal(a, 'a')
          assert.equal(b, 'b')
          assert.equal(c, 'c')
        },
        ['a', 'b', 'c']
      )

      const foo = new toWrap.Foo()
      assert.ok(foo)
    })
  })

  await t.test('#wrapExport', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should execute the given wrap function', function (t) {
      const { shim } = t.nr
      let executed = false
      shim.wrapExport({}, function () {
        executed = true
      })
      assert.equal(executed, true)
    })

    await t.test('should store the wrapped version for later retrival', function (t) {
      const { shim } = t.nr
      const original = {}
      const wrapped = shim.wrapExport(original, function () {
        return {}
      })

      const xport = shim.getExport()
      assert.equal(xport, wrapped)
      assert.notEqual(xport, original)
    })
  })

  await t.test('#record', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.record(wrappable, function () {})
      assert.equal(wrapped, wrappable)
      assert.equal(shim.isWrapped(wrapped), false)
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.record(wrappable.bar, function () {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.record(wrappable.bar, null, function () {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.record(wrappable, 'bar', function () {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.record(wrappable, 'name', function () {})
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should not create a child segment', function (t, end) {
      const { agent, tracer, shim, wrappable } = t.nr
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'internal test segment', internal: true })
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = tracer.getSegment()
        startingSegment.internal = true
        startingSegment.shim = shim
        const segment = wrappable.getActiveSegment()
        assert.equal(segment, startingSegment)
        assert.equal(segment.transaction, tx)
        assert.equal(segment.name, 'ROOT')
        assert.equal(tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test('should still bind the callback', function (t, end) {
      const { agent, tracer, shim } = t.nr
      const wrapped = shim.record(
        function (cb) {
          assert.equal(shim.isWrapped(cb), true)
          end()
        },
        function () {
          return new RecorderSpec({ name: 'test segment', internal: true, callback: shim.LAST })
        }
      )

      helper.runInTransaction(agent, function () {
        const startingSegment = tracer.getSegment()
        startingSegment.internal = true
        startingSegment.shim = shim
        wrapped(function () {})
      })
    })

    await t.test('should not throw when using an ended segment as parent', function (t, end) {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, function (tx) {
        tx.end()
        const wrapped = shim.record(
          function (cb) {
            assert.equal(shim.isWrapped(cb), false)
            assert.equal(agent.getTransaction(), null)
          },
          function () {
            return new RecorderSpec({
              name: 'test segment',
              internal: true,
              callback: shim.LAST,
              parent: tx.trace.root
            })
          }
        )
        assert.doesNotThrow(function () {
          wrapped(function () {})
        })
        end()
      })
    })

    await t.test(
      'should call after hook on record when function is done executing',
      function (t, end) {
        const { agent, shim } = t.nr
        helper.runInTransaction(agent, function () {
          function testAfter() {
            return 'result'
          }
          const wrapped = shim.record(testAfter, function () {
            return new RecorderSpec({
              name: 'test segment',
              callback: shim.LAST,
              after(args) {
                assert.equal(Object.keys(args).length, 6, 'should have 6 args to after hook')
                const { fn, name, error, result, segment } = args
                assert.equal(segment.name, 'test segment')
                assert.equal(error, undefined)
                assert.deepEqual(fn, testAfter)
                assert.equal(name, testAfter.name)
                assert.equal(result, 'result')
              }
            })
          })
          assert.doesNotThrow(function () {
            wrapped()
          })
          end()
        })
      }
    )

    await t.test(
      'should call after hook on record when the function is done executing after failure',
      function (t, end) {
        const { agent, shim } = t.nr
        const err = new Error('test err')
        helper.runInTransaction(agent, function () {
          function testAfter() {
            throw err
          }
          const wrapped = shim.record(testAfter, function () {
            return new RecorderSpec({
              name: 'test segment',
              callback: shim.LAST,
              after(args) {
                assert.equal(Object.keys(args).length, 6, 'should have 6 args to after hook')
                const { fn, name, error, result, segment } = args
                assert.equal(segment.name, 'test segment')
                assert.deepEqual(error, err)
                assert.equal(result, undefined)
                assert.deepEqual(fn, testAfter)
                assert.equal(name, testAfter.name)
              }
            })
          })
          assert.throws(function () {
            wrapped()
          })
          end()
        })
      }
    )
  })

  await t.test('#record with a stream', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const stream = new EventEmitter()
      ctx.nr.toWrap = function () {
        stream.segment = ctx.nr.tracer.getSegment()
        return stream
      }
      ctx.nr.stream = stream
    })

    t.afterEach(afterEach)

    await t.test('should make the segment translucent when `end` is emitted', function (t, end) {
      const { agent, shim, stream, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true, opaque: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        assert.equal(ret, stream)
      })

      assert.equal(stream.segment.opaque, true)
      setTimeout(function () {
        stream.emit('end')
        assert.equal(stream.segment.opaque, false)
        end()
      }, 5)
    })

    await t.test('should touch the segment when `end` is emitted', function (t, end) {
      const { agent, shim, stream, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        assert.equal(ret, stream)
      })

      const oldDur = stream.segment.timer.getDurationInMillis()
      setTimeout(function () {
        stream.emit('end')
        assert.ok(stream.segment.timer.getDurationInMillis() > oldDur)
        end()
      }, 5)
    })

    await t.test('should make the segment translucent when `error` is emitted', function (t, end) {
      const { agent, shim, stream, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true, opaque: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        assert.equal(ret, stream)
      })

      stream.on('error', function () {}) // to prevent the error being thrown
      assert.equal(stream.segment.opaque, true)
      setTimeout(function () {
        stream.emit('error', 'foobar')
        assert.equal(stream.segment.opaque, false)
        end()
      }, 5)
    })

    await t.test('should touch the segment when `error` is emitted', function (t, end) {
      const { agent, shim, stream, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        assert.equal(ret, stream)
      })

      stream.on('error', function () {}) // to prevent the error being thrown
      const oldDur = stream.segment.timer.getDurationInMillis()
      setTimeout(function () {
        stream.emit('error', 'foobar')
        assert.ok(stream.segment.timer.getDurationInMillis() > oldDur)
        end()
      }, 5)
    })

    await t.test('should throw if there are no other `error` handlers', function (t) {
      const { agent, shim, stream, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        assert.equal(ret, stream)
      })

      assert.throws(function () {
        stream.emit('error', new Error('foobar'))
      }, 'Error: foobar')
    })

    await t.test('should bind emit to a child segment', function (t, end) {
      const { agent, shim, stream, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: 'foobar' })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        assert.equal(ret, stream)
      })

      stream.on('foobar', function () {
        const emitSegment = shim.getSegment()
        assert.equal(emitSegment.parent, stream.segment)
        end()
      })
      stream.emit('foobar')
    })

    await t.test('should create an event segment if an event name is given', function (t) {
      const { agent, shim, stream, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: 'foobar' })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        assert.equal(ret, stream)
      })

      // Emit the event and check the segment name.
      assert.equal(stream.segment.children.length, 0)
      stream.emit('foobar')
      assert.equal(stream.segment.children.length, 1)

      const [eventSegment] = stream.segment.children
      assert.match(eventSegment.name, /Event callback: foobar/)
      assert.equal(eventSegment.getAttributes().count, 1)

      // Emit it again and see if the name updated.
      stream.emit('foobar')
      assert.equal(stream.segment.children.length, 1)
      assert.equal(stream.segment.children[0], eventSegment)
      assert.equal(eventSegment.getAttributes().count, 2)

      // Emit it once more and see if the name updated again.
      stream.emit('foobar')
      assert.equal(stream.segment.children.length, 1)
      assert.equal(stream.segment.children[0], eventSegment)
      assert.equal(eventSegment.getAttributes().count, 3)
    })
  })

  await t.test('#record with a promise', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { promise, resolve, reject } = promiseResolvers()
      const toWrap = function () {
        promise.segment = ctx.nr.tracer.getSegment()
        return promise
      }
      ctx.nr.promise = promise
      ctx.nr.toWrap = toWrap
      ctx.nr.resolve = resolve
      ctx.nr.reject = reject
    })

    t.afterEach(afterEach)

    await t.test('should make the segment translucent when promise resolves', async function (t) {
      const plan = tspl(t, { plan: 4 })
      const { agent, promise, resolve, shim, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true, opaque: true })
      })

      const result = {}
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        plan.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret.then(function (val) {
          plan.equal(result, val)
          plan.equal(promise.segment.opaque, false)
        })
      })

      plan.equal(promise.segment.opaque, true)
      setTimeout(function () {
        resolve(result)
      }, 5)
      await plan.completed
    })

    await t.test('should touch the segment when promise resolves', async function (t) {
      const plan = tspl(t, { plan: 3 })
      const { agent, promise, resolve, shim, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true })
      })

      const result = {}
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        const oldDur = promise.segment.timer.getDurationInMillis()
        plan.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret.then(function (val) {
          plan.equal(result, val)
          plan.ok(promise.segment.timer.getDurationInMillis() > oldDur)
        })
      })

      setTimeout(function () {
        resolve(result)
      }, 5)
      await plan.completed
    })

    await t.test('should make the segment translucent when promise rejects', async function (t) {
      const plan = tspl(t, { plan: 4 })
      const { agent, promise, reject, shim, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true, opaque: true })
      })

      const result = new Error('translucent when promise rejects')
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        plan.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret.then(
          function () {
            throw new Error('Should not have resolved!')
          },
          function (err) {
            plan.equal(err, result)
            plan.equal(promise.segment.opaque, false)
          }
        )
      })

      plan.equal(promise.segment.opaque, true)
      setTimeout(function () {
        reject(result)
      }, 5)
      await plan.completed
    })

    await t.test('should touch the segment when promise rejects', async function (t) {
      const plan = tspl(t, { plan: 3 })
      const { agent, promise, reject, shim, toWrap } = t.nr
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true })
      })

      const result = new Error('touch segment when promise rejects')
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        const oldDur = promise.segment.timer.getDurationInMillis()
        plan.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret.then(
          function () {},
          function (err) {
            plan.equal(err, result)
            plan.ok(promise.segment.timer.getDurationInMillis() > oldDur)
          }
        )
      })

      setTimeout(function () {
        reject(result)
      }, 5)
      await plan.completed
    })

    await t.test('should not affect unhandledRejection event', async (t) => {
      const plan = tspl(t, { plan: 2 })
      const { agent, promise, reject, shim, toWrap } = t.nr
      const result = new Error('unhandled rejection test')

      tempOverrideUncaught({
        t,
        type: tempOverrideUncaught.REJECTION,
        handler(err) {
          plan.deepEqual(err, result)
        }
      })

      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        plan.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret.then(() => {})
      })

      setTimeout(function () {
        reject(result)
      }, 5)

      await plan.completed
    })

    await t.test('should call after hook when promise resolves', async (t) => {
      const plan = tspl(t, { plan: 7 })
      const { agent, promise, resolve, shim, toWrap } = t.nr
      const segmentName = 'test segment'
      const expectedResult = { returned: true }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({
          name: segmentName,
          promise: true,
          after(args) {
            plan.equal(Object.keys(args).length, 6, 'should have 6 args to after hook')
            const { fn, name, error, result, segment } = args
            plan.deepEqual(fn, toWrap)
            plan.equal(name, toWrap.name)
            plan.equal(error, null)
            plan.deepEqual(result, expectedResult)
            plan.equal(segment.name, segmentName)
          }
        })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        plan.ok(ret instanceof Object.getPrototypeOf(promise).constructor)
      })

      setTimeout(function () {
        resolve(expectedResult)
      }, 5)

      await plan.completed
    })

    await t.test('should call after hook when promise reject', async (t) => {
      const plan = tspl(t, { plan: 6 })
      const { agent, promise, reject, shim, toWrap } = t.nr
      const segmentName = 'test segment'
      const expectedResult = new Error('should call after hook when promise rejects')
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({
          name: segmentName,
          promise: true,
          after(args) {
            plan.equal(Object.keys(args).length, 5, 'should have 6 args to after hook')
            const { fn, name, error, segment } = args
            plan.deepEqual(fn, toWrap)
            plan.equal(name, toWrap.name)
            plan.deepEqual(error, expectedResult)
            plan.equal(segment.name, segmentName)
          }
        })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        plan.ok(ret instanceof Object.getPrototypeOf(promise).constructor)
      })

      setTimeout(function () {
        reject(expectedResult)
      }, 5)
      await plan.completed
    })
  })

  await t.test('#record wrapper when called without a transaction', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should not create a segment', function (t) {
      const { shim, wrappable } = t.nr
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      const segment = wrappable.getActiveSegment()
      assert.equal(segment, null)
    })

    await t.test('should execute the wrapped function', function (t) {
      const { shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      assert.equal(executed, false)
      wrapped()
      assert.equal(executed, true)
    })

    await t.test('should still invoke the spec', function (t) {
      const { shim, wrappable } = t.nr
      let executed = false
      shim.record(wrappable, 'bar', function () {
        executed = true
      })

      assert.equal(executed, false)
      wrappable.bar('a', 'b', 'c')
      assert.equal(executed, true)
    })

    await t.test('should not bind the callback if there is one', function (t, end) {
      const { shim } = t.nr
      const cb = function () {}
      const toWrap = function (wrappedCB) {
        assert.equal(wrappedCB, cb)
        assert.ok(!shim.isWrapped(wrappedCB))
        end()
      }

      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', callback: shim.LAST })
      })
      wrapped(cb)
    })

    await t.test('should not bind the rowCallback if there is one', function (t, end) {
      const { shim } = t.nr
      const wrapped = shim.record(checkNotWrappedCb.bind(null, shim, end), function () {
        return new RecorderSpec({ name: 'test segment', rowCallback: shim.LAST })
      })
      wrapped(end)
    })
  })

  await t.test('#record wrapper when called in an active transaction', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create a segment', function (t, end) {
      const { agent, tracer, shim, wrappable } = t.nr
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = tracer.getSegment()
        const segment = wrappable.getActiveSegment()
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.transaction, tx)
        assert.equal(segment.name, 'test segment')
        assert.equal(tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test('should execute the wrapped function', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function () {
        assert.equal(executed, false)
        wrapped()
        assert.equal(executed, true)
        end()
      })
    })

    await t.test(
      'should invoke the spec in the context of the wrapped function',
      function (t, end) {
        const { agent, shim, wrappable } = t.nr
        const original = wrappable.bar
        let executed = false
        shim.record(wrappable, 'bar', function (_, fn, name, args) {
          executed = true
          assert.equal(fn, original)
          assert.equal(name, 'bar')
          assert.equal(this, wrappable)
          assert.deepEqual(args, ['a', 'b', 'c'])
        })

        helper.runInTransaction(agent, function () {
          assert.equal(executed, false)
          wrappable.bar('a', 'b', 'c')
          assert.equal(executed, true)
          end()
        })
      }
    )

    await t.test('should bind the callback if there is one', function (t, end) {
      const { agent, shim } = t.nr
      const cb = function () {}
      const toWrap = function (wrappedCB) {
        assert.notEqual(wrappedCB, cb)
        assert.equal(shim.isWrapped(wrappedCB), true)
        assert.equal(shim.unwrap(wrappedCB), cb)

        assert.doesNotThrow(function () {
          wrappedCB()
        })
        end()
      }

      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', callback: shim.LAST })
      })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })

    await t.test('should bind the rowCallback if there is one', function (t, end) {
      const { agent, shim } = t.nr

      const wrapped = shim.record(checkWrappedCb.bind(null, shim, end), function () {
        return new RecorderSpec({ name: 'test segment', rowCallback: shim.LAST })
      })

      helper.runInTransaction(agent, function () {
        wrapped(end)
      })
    })
  })

  await t.test('#record wrapper when callback required', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create segment if method has callback', function (t, end) {
      const { agent, shim } = t.nr
      const cb = function () {}
      const toWrap = function (wrappedCB) {
        assert.notEqual(wrappedCB, cb)
        assert.equal(shim.isWrapped(wrappedCB), true)
        assert.equal(shim.unwrap(wrappedCB), cb)

        assert.doesNotThrow(function () {
          wrappedCB()
        })

        return shim.getSegment()
      }

      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({
          name: 'test segment',
          callback: shim.LAST,
          callbackRequired: true
        })
      })

      helper.runInTransaction(agent, function () {
        const parentSegment = shim.getSegment()
        const resultingSegment = wrapped(cb)

        assert.notEqual(resultingSegment, parentSegment)
        assert.ok(parentSegment.children.includes(resultingSegment))
        end()
      })
    })

    await t.test('should not create segment if method missing callback', function (t, end) {
      const { agent, shim } = t.nr
      const toWrap = function (wrappedCB) {
        assert.ok(!wrappedCB)

        return shim.getSegment()
      }

      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({
          name: 'test segment',
          callback: shim.LAST,
          callbackRequired: true
        })
      })

      helper.runInTransaction(agent, function () {
        const parentSegment = shim.getSegment()
        const resultingSegment = wrapped()

        assert.equal(resultingSegment, parentSegment)
        assert.ok(!parentSegment.children.includes(resultingSegment))
        end()
      })
    })
  })

  await t.test('#record wrapper when called with an inactive transaction', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should not create a segment', function (t, end) {
      const { agent, tracer, shim, wrappable } = t.nr
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = tracer.getSegment()
        tx.end()
        const segment = wrappable.getActiveSegment()
        assert.equal(segment, startingSegment)
        end()
      })
    })

    await t.test('should execute the wrapped function', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        assert.equal(executed, false)
        wrapped()
        assert.equal(executed, true)
        end()
      })
    })

    await t.test('should still invoke the spec', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      let executed = false
      shim.record(wrappable, 'bar', function () {
        executed = true
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        wrappable.bar('a', 'b', 'c')
        assert.equal(executed, true)
        end()
      })
    })

    await t.test('should not bind the callback if there is one', function (t, end) {
      const { agent, shim } = t.nr
      const wrapped = shim.record(checkNotWrappedCb.bind(null, shim, end), function () {
        return new RecorderSpec({ name: 'test segment', callback: shim.LAST })
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        wrapped(end)
      })
    })

    await t.test('should not bind the rowCallback if there is one', function (t, end) {
      const { agent, shim } = t.nr
      const wrapped = shim.record(checkNotWrappedCb.bind(null, shim, end), function () {
        return new RecorderSpec({ name: 'test segment', rowCallback: shim.LAST })
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        wrapped(end)
      })
    })
  })

  await t.test('#isWrapped', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should return true if the object was wrapped', function (t) {
      const { shim } = t.nr
      const toWrap = function () {}
      assert.equal(shim.isWrapped(toWrap), false)

      const wrapped = shim.wrap(toWrap, function () {
        return function () {}
      })
      assert.equal(shim.isWrapped(wrapped), true)
    })

    await t.test('should not error if the object is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.isWrapped(null)
      })

      assert.equal(shim.isWrapped(null), false)
    })

    await t.test('should return true if the property was wrapped', function (t) {
      const { shim, wrappable } = t.nr
      assert.equal(shim.isWrapped(wrappable, 'bar'), false)

      shim.wrap(wrappable, 'bar', function () {
        return function () {}
      })
      assert.equal(shim.isWrapped(wrappable, 'bar'), true)
    })

    await t.test('should not error if the object is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.isWrapped(null, 'bar')
      })
      assert.equal(shim.isWrapped(null, 'bar'), false)
    })

    await t.test('should not error if the property is `null`', function (t) {
      const { shim, wrappable } = t.nr
      assert.doesNotThrow(function () {
        shim.isWrapped(wrappable, 'this does not exist')
      })
      assert.equal(shim.isWrapped(wrappable, 'this does not exist'), false)
    })
  })

  await t.test('#unwrap', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { shim, wrappable } = ctx.nr
      const original = function () {}
      ctx.nr.wrapped = shim.wrap(original, function () {
        return function () {}
      })
      shim.wrap(wrappable, ['bar', 'fiz', 'getActiveSegment'], function () {
        return function () {}
      })
      ctx.nr.original = original
    })
    t.afterEach(afterEach)

    await t.test('should not error if the item is not wrapped', function (t) {
      const { original, shim } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrap(original)
      })
      assert.equal(shim.unwrap(original), original)
    })

    await t.test('should unwrap the first parameter', function (t) {
      const { original, shim, wrapped } = t.nr
      assert.equal(shim.unwrap(wrapped), original)
    })

    await t.test('should not error if `nodule` is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrap(null)
      })
    })

    await t.test('should accept a single property', function (t) {
      const { shim, wrappable } = t.nr
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.doesNotThrow(function () {
        shim.unwrap(wrappable, 'bar')
      })
      assert.equal(shim.isWrapped(wrappable.bar), false)
    })

    await t.test('should accept an array of properties', function (t) {
      const { shim, wrappable } = t.nr
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.isWrapped(wrappable.fiz), true)
      assert.equal(shim.isWrapped(wrappable.getActiveSegment), true)
      assert.doesNotThrow(function () {
        shim.unwrap(wrappable, ['bar', 'fiz', 'getActiveSegment'])
      })
      assert.equal(shim.isWrapped(wrappable.bar), false)
      assert.equal(shim.isWrapped(wrappable.fiz), false)
      assert.equal(shim.isWrapped(wrappable.getActiveSegment), false)
    })

    await t.test('should not error if a nodule is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrap(null, 'bar')
      })
    })

    await t.test('should not error if a property is `null`', function (t) {
      const { shim, wrappable } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrap(wrappable, 'this does not exist')
      })
    })
  })

  await t.test('#unwrapOnce', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { shim, wrappable } = ctx.nr
      const original = function () {}
      ctx.nr.wrapped = shim.wrap(original, function () {
        return function () {}
      })
      shim.wrap(wrappable, ['bar', 'fiz', 'getActiveSegment'], function () {
        return function () {}
      })
      ctx.nr.original = original
    })
    t.afterEach(afterEach)

    await t.test('should not error if the item is not wrapped', function (t) {
      const { original, shim } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrapOnce(original)
      })
      assert.equal(shim.unwrapOnce(original), original)
    })

    await t.test('should not fully unwrap multiple nested wrappers', function (t) {
      const { original, shim } = t.nr
      let { wrapped } = t.nr
      for (let i = 0; i < 10; ++i) {
        wrapped = shim.wrap(wrapped, function () {
          return function () {}
        })
      }

      assert.notEqual(wrapped, original)
      assert.notEqual(wrapped[symbols.original], original)
      assert.notEqual(shim.unwrapOnce(wrapped), original)
    })

    await t.test('should unwrap the first parameter', function (t) {
      const { original, shim, wrapped } = t.nr
      assert.equal(shim.unwrapOnce(wrapped), original)
    })

    await t.test('should not error if `nodule` is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrapOnce(null)
      })
    })

    await t.test('should accept a single property', function (t) {
      const { shim, wrappable } = t.nr
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.doesNotThrow(function () {
        shim.unwrapOnce(wrappable, 'bar')
      })
      assert.equal(shim.isWrapped(wrappable.bar), false)
    })

    await t.test('should accept an array of properties', function (t) {
      const { shim, wrappable } = t.nr
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.isWrapped(wrappable.fiz), true)
      assert.equal(shim.isWrapped(wrappable.getActiveSegment), true)
      assert.doesNotThrow(function () {
        shim.unwrapOnce(wrappable, ['bar', 'fiz', 'getActiveSegment'])
      })
      assert.equal(shim.isWrapped(wrappable.bar), false)
      assert.equal(shim.isWrapped(wrappable.fiz), false)
      assert.equal(shim.isWrapped(wrappable.getActiveSegment), false)
    })

    await t.test('should not error if a nodule is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrapOnce(null, 'bar')
      })
    })

    await t.test('should not error if a property is `null`', function (t) {
      const { shim, wrappable } = t.nr
      assert.doesNotThrow(function () {
        shim.unwrapOnce(wrappable, 'this does not exist')
      })
    })
  })

  await t.test('#getSegment', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      ctx.nr.segment = { probe: function () {} }
    })
    t.afterEach(afterEach)

    await t.test('should return the segment a function is bound to', function (t) {
      const { segment, shim } = t.nr
      const bound = shim.bindSegment(function () {}, segment)
      assert.equal(shim.getSegment(bound), segment)
    })

    await t.test('should return the current segment if the function is not bound', function (t) {
      const { tracer, segment, shim } = t.nr
      tracer.setSegment(segment)
      assert.equal(
        shim.getSegment(function () {}),
        segment
      )
    })

    await t.test('should return the current segment if no object is provided', function (t) {
      const { tracer, segment, shim } = t.nr
      tracer.setSegment(segment)
      assert.equal(shim.getSegment(), segment)
    })
  })

  await t.test('#getActiveSegment', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      ctx.nr.segment = {
        probe: function () {},
        transaction: {
          active: true,
          isActive: function () {
            return this.active
          }
        }
      }
    })
    t.afterEach(afterEach)

    await t.test(
      'should return the segment a function is bound to when transaction is active',
      function (t) {
        const { segment, shim } = t.nr
        const bound = shim.bindSegment(function () {}, segment)
        assert.equal(shim.getActiveSegment(bound), segment)
      }
    )

    await t.test(
      'should return the current segment if the function is not bound when transaction is active',
      function (t) {
        const { tracer, segment, shim } = t.nr
        tracer.setSegment(segment)
        assert.equal(
          shim.getActiveSegment(function () {}),
          segment
        )
      }
    )

    await t.test(
      'should return the current segment if no object is provided when transaction is active',
      function (t) {
        const { tracer, segment, shim } = t.nr
        tracer.setSegment(segment)
        assert.equal(shim.getActiveSegment(), segment)
      }
    )

    await t.test(
      'should return null for a bound function when transaction is not active',
      function (t) {
        const { segment, shim } = t.nr
        segment.transaction.active = false
        const bound = shim.bindSegment(function () {}, segment)
        assert.equal(shim.getActiveSegment(bound), null)
      }
    )

    await t.test(
      'should return null if the function is not bound when transaction is not active',
      function (t) {
        const { tracer, segment, shim } = t.nr
        segment.transaction.active = false
        tracer.setSegment(segment)
        assert.equal(
          shim.getActiveSegment(function () {}),
          null
        )
      }
    )

    await t.test(
      'should return null if no object is provided when transaction is not active',
      function (t) {
        const { tracer, segment, shim } = t.nr
        segment.transaction.active = false
        tracer.setSegment(segment)
        assert.equal(shim.getActiveSegment(), null)
      }
    )
  })

  await t.test('#storeSegment', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should store the segment on the object', function (t) {
      const { shim, wrappable } = t.nr
      const segment = { probe: function () {} }
      shim.storeSegment(wrappable, segment)
      assert.equal(shim.getSegment(wrappable), segment)
    })

    await t.test('should default to the current segment', function (t) {
      const { tracer, shim, wrappable } = t.nr
      const segment = { probe: function () {} }
      tracer.setSegment(segment)
      shim.storeSegment(wrappable)
      assert.equal(shim.getSegment(wrappable), segment)
    })

    await t.test('should not fail if the object is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.storeSegment(null)
      })
    })
  })

  await t.test('#bindCallbackSegment', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      ctx.nr.cbCalled = false
      ctx.nr.cb = function () {
        ctx.nr.cbCalled = true
      }
    })
    t.afterEach(afterEach)

    await t.test('should wrap the callback in place', function (t) {
      const { cb, shim } = t.nr
      const args = ['a', cb, 'b']
      shim.bindCallbackSegment({}, args, shim.SECOND)

      const [, wrapped] = args
      assert.ok(wrapped instanceof Function)
      assert.notEqual(wrapped, cb)
      assert.deepEqual(args, ['a', wrapped, 'b'])
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), cb)
    })

    await t.test('should work with an array and numeric index', function (t) {
      const { cb, shim } = t.nr
      const args = ['a', cb, 'b']
      shim.bindCallbackSegment({}, args, 1)
      assert.equal(shim.isWrapped(args[1]), true)
    })

    await t.test('should work with an object and a string index', function (t) {
      const { cb, shim } = t.nr
      const opts = { a: 'a', cb, b: 'b' }
      shim.bindCallbackSegment({}, opts, 'cb')
      assert.equal(shim.isWrapped(opts, 'cb'), true)
    })

    await t.test('should not error if `args` is `null`', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.bindCallbackSegment({}, null, 1)
      })
    })

    await t.test('should not error if the callback does not exist', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        const args = ['a']
        shim.bindCallbackSegment({}, args, 1)
      })
    })

    await t.test('should not bind if the "callback" is not a function', function (t) {
      const { shim } = t.nr
      let args
      assert.doesNotThrow(function () {
        args = ['a']
        shim.bindCallbackSegment({}, args, 0)
      })

      assert.equal(shim.isWrapped(args[0]), false)
      assert.equal(args[0], 'a')
    })

    await t.test('should execute the callback', function (t) {
      const { shim, cb } = t.nr
      const args = ['a', 'b', cb]
      shim.bindCallbackSegment({}, args, shim.LAST)

      assert.equal(t.nr.cbCalled, false)
      args[2]()
      assert.equal(t.nr.cbCalled, true)
    })

    await t.test('should create a new segment', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      helper.runInTransaction(agent, function () {
        const args = [wrappable.getActiveSegment]
        const segment = wrappable.getActiveSegment()
        const parent = shim.createSegment('test segment')
        shim.bindCallbackSegment({}, args, shim.LAST, parent)
        const cbSegment = args[0]()

        assert.notEqual(cbSegment, segment)
        assert.notEqual(cbSegment, parent)
        compareSegments(parent, [cbSegment])
        end()
      })
    })

    await t.test('should make the `parentSegment` translucent after running', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      helper.runInTransaction(agent, function () {
        const args = [wrappable.getActiveSegment]
        const parent = shim.createSegment('test segment')
        parent.opaque = true
        shim.bindCallbackSegment({}, args, shim.LAST, parent)
        const cbSegment = args[0]()

        assert.notEqual(cbSegment, parent)
        compareSegments(parent, [cbSegment])
        assert.equal(parent.opaque, false)
        end()
      })
    })

    await t.test('should default the `parentSegment` to the current one', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      helper.runInTransaction(agent, function () {
        const args = [wrappable.getActiveSegment]
        const segment = wrappable.getActiveSegment()
        shim.bindCallbackSegment({}, args, shim.LAST)
        const cbSegment = args[0]()

        assert.notEqual(cbSegment, segment)
        compareSegments(segment, [cbSegment])
        end()
      })
    })

    await t.test('should call the after hook if specified on the spec', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      let executed = false
      const spec = {
        after() {
          executed = true
        }
      }
      helper.runInTransaction(agent, function () {
        const args = [wrappable.getActiveSegment]
        const segment = wrappable.getActiveSegment()
        shim.bindCallbackSegment(spec, args, shim.LAST)
        const cbSegment = args[0]()

        assert.notEqual(cbSegment, segment)
        compareSegments(segment, [cbSegment])
        assert.equal(executed, true)
        end()
      })
    })
  })

  await t.test('#applySegment', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      ctx.nr.segment = {
        name: 'segment',
        started: false,
        touched: false,
        start: function () {
          this.started = true
        },
        touch: function () {
          this.touched = true
        },
        probe: function () {
          this.probed = true
        }
      }
    })
    t.afterEach(afterEach)

    await t.test('should call the function with the `context` and `args`', function (t) {
      const { segment, shim } = t.nr
      const context = { name: 'context' }
      const value = { name: 'value' }
      const ret = shim.applySegment(
        function (a, b, c) {
          assert.equal(this, context)
          assert.equal(arguments.length, 3)
          assert.equal(a, 'a')
          assert.equal(b, 'b')
          assert.equal(c, 'c')
          return value
        },
        segment,
        false,
        context,
        ['a', 'b', 'c']
      )

      assert.equal(ret, value)
    })

    await t.test(
      'should execute the inContext callback under the produced segment',
      function (t, end) {
        const { tracer, segment, shim } = t.nr
        shim.applySegment(
          function () {},
          segment,
          false,
          {},
          [],
          function checkSegment(activeSegment) {
            assert.equal(activeSegment, segment)
            assert.equal(tracer.getSegment(), segment)
            end()
          }
        )
      }
    )

    await t.test('should make the segment active for the duration of execution', function (t) {
      const { tracer, segment, shim, wrappable } = t.nr
      const prevSegment = { name: 'prevSegment', probe: function () {} }
      tracer.setSegment(prevSegment)

      const activeSegment = shim.applySegment(wrappable.getActiveSegment, segment)
      assert.equal(tracer.getSegment(), prevSegment)
      assert.equal(activeSegment, segment)
      assert.equal(segment.touched, false)
      assert.equal(segment.started, false)
    })

    await t.test('should start and touch the segment if `full` is `true`', function (t) {
      const { segment, shim, wrappable } = t.nr
      shim.applySegment(wrappable.getActiveSegment, segment, true)
      assert.equal(segment.touched, true)
      assert.equal(segment.started, true)
    })

    await t.test('should not change the active segment if `segment` is `null`', function (t) {
      const { tracer, segment, shim, wrappable } = t.nr
      tracer.setSegment(segment)
      let activeSegment = null
      assert.doesNotThrow(function () {
        activeSegment = shim.applySegment(wrappable.getActiveSegment, null)
      })
      assert.equal(tracer.getSegment(), segment)
      assert.equal(activeSegment, segment)
    })

    await t.test('should not throw in a transaction when `func` has no `.apply` method', (t) => {
      const { segment, shim } = t.nr
      const func = function () {}
      // eslint-disable-next-line no-proto
      func.__proto__ = {}
      assert.ok(!func.apply)
      assert.doesNotThrow(() => shim.applySegment(func, segment))
    })

    await t.test('should not throw out of a transaction', (t) => {
      const { shim } = t.nr
      const func = function () {}
      // eslint-disable-next-line no-proto
      func.__proto__ = {}
      assert.ok(!func.apply)
      assert.doesNotThrow(() => shim.applySegment(func, null))
    })

    await t.test('should not swallow the exception when `func` throws an exception', function (t) {
      const { segment, shim } = t.nr
      const func = function () {
        throw new Error('test error')
      }

      assert.throws(function () {
        shim.applySegment(func, segment)
      }, 'Error: test error')
    })

    await t.test(
      'should still return the active segment to the previous one when `func` throws an exception',
      function (t) {
        const { tracer, segment, shim } = t.nr
        const func = function () {
          throw new Error('test error')
        }
        const prevSegment = { name: 'prevSegment', probe: function () {} }
        tracer.setSegment(prevSegment)

        assert.throws(function () {
          shim.applySegment(func, segment)
        }, 'Error: test error')

        assert.equal(tracer.getSegment(), prevSegment)
      }
    )
    await t.test(
      'should still touch the segment if `full` is `true` when `func` throws an exception',
      function (t) {
        const { segment, shim } = t.nr
        const func = function () {
          throw new Error('test error')
        }
        assert.throws(function () {
          shim.applySegment(func, segment, true)
        }, 'Error: test error')

        assert.equal(segment.touched, true)
      }
    )
  })

  await t.test('#createSegment', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create a segment with the correct name', function (t, end) {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, function () {
        const segment = shim.createSegment('foobar')
        assert.equal(segment.name, 'foobar')
        end()
      })
    })

    await t.test('should allow `recorder` to be omitted', function (t, end) {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        const child = shim.createSegment('child', parent)
        assert.equal(child.name, 'child')
        compareSegments(parent, [child])
        end()
      })
    })

    await t.test('should allow `recorder` to be null', function (t, end) {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        const child = shim.createSegment('child', null, parent)
        assert.equal(child.name, 'child')
        compareSegments(parent, [child])
        end()
      })
    })

    await t.test('should not create children for opaque segments', function (t, end) {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        parent.opaque = true
        const child = shim.createSegment('child', parent)
        assert.equal(child.name, 'parent')
        assert.deepEqual(parent.children, [])
        end()
      })
    })

    await t.test('should not modify returned parent for opaque segments', (t, end) => {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, () => {
        const parent = shim.createSegment('parent')
        parent.opaque = true
        parent.internal = true

        const child = shim.createSegment('child', parent)

        assert.equal(child, parent)
        assert.equal(parent.opaque, true)
        assert.equal(parent.internal, true)
        end()
      })
    })

    await t.test('should default to the current segment as the parent', function (t, end) {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, function () {
        const parent = shim.getSegment()
        const child = shim.createSegment('child')
        compareSegments(parent, [child])
        end()
      })
    })

    await t.test('should not modify returned parent for opaque segments', (t, end) => {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, () => {
        const parent = shim.createSegment('parent')
        parent.opaque = true
        parent.internal = true

        shim.setActiveSegment(parent)

        const child = shim.createSegment('child')

        assert.equal(child, parent)
        assert.equal(parent.opaque, true)
        assert.equal(parent.internal, true)
        end()
      })
    })

    await t.test('should work with all parameters in an object', function (t, end) {
      const { agent, shim } = t.nr
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        const child = shim.createSegment({ name: 'child', parent })
        assert.equal(child.name, 'child')
        compareSegments(parent, [child])
        end()
      })
    })
  })

  await t.test('#createSegment when an `parameters` object is provided', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { agent, shim } = ctx.nr
      const parameters = {
        host: 'my awesome host',
        port_path_or_id: 1234,
        database_name: 'my_db',
        foo: 'bar',
        fiz: 'bang',
        ignore_me: 'baz'
      }

      agent.config.attributes.exclude = ['ignore_me', 'host', 'port_path_or_id', 'database_name']
      agent.config.emit('attributes.exclude')
      agent.config.attributes.enabled = true
      helper.runInTransaction(agent, function () {
        ctx.nr.segment = shim.createSegment({ name: 'child', parameters })
      })
      ctx.nr.parameters = parameters
    })
    t.afterEach(afterEach)

    await t.test(
      'should copy parameters provided into `segment.parameters` and `attributes.enabled` is true',
      function (t) {
        const { segment } = t.nr
        assert.ok(segment.attributes)
        const attributes = segment.getAttributes()
        assert.equal(attributes.foo, 'bar')
        assert.equal(attributes.fiz, 'bang')
      }
    )

    await t.test(
      'should be affected by `attributes.exclude` and `attributes.enabled` is true',
      function (t) {
        const { segment } = t.nr
        assert.ok(segment.attributes)
        const attributes = segment.getAttributes()
        assert.equal(attributes.foo, 'bar')
        assert.equal(attributes.fiz, 'bang')
        assert.ok(!attributes.ignore_me)
        assert.ok(!attributes.host)
        assert.ok(!attributes.port_path_or_id)
        assert.ok(!attributes.database_name)
      }
    )

    await t.test(
      'should not copy parameters into segment attributes when `attributes.enabled` is fale',
      function (t) {
        const { agent, parameters, shim } = t.nr
        let segment
        agent.config.attributes.enabled = false
        helper.runInTransaction(agent, function () {
          segment = shim.createSegment({ name: 'child', parameters })
        })
        assert.ok(segment.attributes)
        const attributes = segment.getAttributes()
        assert.ok(!attributes.foo)
        assert.ok(!attributes.fiz)
        assert.ok(!attributes.ignore_me)
        assert.ok(!attributes.host)
        assert.ok(!attributes.port_path_or_id)
        assert.ok(!attributes.database_name)
      }
    )
  })

  await t.test('#getName', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should return the `name` property of an object if it has one', function (t) {
      const { shim } = t.nr
      assert.equal(shim.getName({ name: 'foo' }), 'foo')
      assert.equal(
        shim.getName(function bar() {}),
        'bar'
      )
    })

    await t.test('should return "<anonymous>" if the object has no name', function (t) {
      const { shim } = t.nr
      assert.equal(shim.getName({}), '<anonymous>')
      assert.equal(
        shim.getName(function () {}),
        '<anonymous>'
      )
    })
  })

  await t.test('#isObject', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should detect if an item is an object', function (t) {
      const { shim } = t.nr
      assert.equal(shim.isObject({}), true)
      assert.equal(shim.isObject([]), true)
      assert.equal(shim.isObject(arguments), true)
      assert.equal(
        shim.isObject(function () {}),
        true
      )
      assert.equal(shim.isObject(Object.create(null)), true)
      assert.equal(shim.isObject(true), false)
      assert.equal(shim.isObject(false), false)
      assert.equal(shim.isObject('foobar'), false)
      assert.equal(shim.isObject(1234), false)
      assert.equal(shim.isObject(null), false)
      assert.equal(shim.isObject(undefined), false)
    })
  })

  await t.test('#isFunction', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should detect if an item is a function', function (t) {
      const { shim } = t.nr
      assert.ok(shim.isFunction(function () {}))
      assert.ok(!shim.isFunction({}))
      assert.ok(!shim.isFunction([]))
      assert.ok(!shim.isFunction(arguments))
      assert.ok(!shim.isFunction(true))
      assert.ok(!shim.isFunction(false))
      assert.ok(!shim.isFunction('foobar'))
      assert.ok(!shim.isFunction(1234))
      assert.ok(!shim.isFunction(null))
      assert.ok(!shim.isFunction(undefined))
    })
  })

  await t.test('#isString', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should detect if an item is a string', function (t) {
      const { shim } = t.nr
      assert.ok(shim.isString('foobar'))
      // eslint-disable-next-line sonarjs/no-primitive-wrappers, no-new-wrappers
      assert.ok(shim.isString(new String('foobar')))
      assert.ok(!shim.isString({}))
      assert.ok(!shim.isString([]))
      assert.ok(!shim.isString(arguments))
      assert.ok(!shim.isString(function () {}))
      assert.ok(!shim.isString(true))
      assert.ok(!shim.isString(false))
      assert.ok(!shim.isString(1234))
      assert.ok(!shim.isString(null))
      assert.ok(!shim.isString(undefined))
    })
  })

  await t.test('#isNumber', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should detect if an item is a number', function (t) {
      const { shim } = t.nr
      assert.ok(shim.isNumber(1234))
      assert.ok(!shim.isNumber({}))
      assert.ok(!shim.isNumber([]))
      assert.ok(!shim.isNumber(arguments))
      assert.ok(!shim.isNumber(function () {}))
      assert.ok(!shim.isNumber(true))
      assert.ok(!shim.isNumber(false))
      assert.ok(!shim.isNumber('foobar'))
      assert.ok(!shim.isNumber(null))
      assert.ok(!shim.isNumber(undefined))
    })
  })

  await t.test('#isBoolean', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should detect if an item is a boolean', function (t) {
      const { shim } = t.nr
      assert.ok(shim.isBoolean(true))
      assert.ok(shim.isBoolean(false))
      assert.ok(!shim.isBoolean({}))
      assert.ok(!shim.isBoolean([]))
      assert.ok(!shim.isBoolean(arguments))
      assert.ok(!shim.isBoolean(function () {}))
      assert.ok(!shim.isBoolean('foobar'))
      assert.ok(!shim.isBoolean(1234))
      assert.ok(!shim.isBoolean(null))
      assert.ok(!shim.isBoolean(undefined))
    })
  })

  await t.test('#isArray', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should detect if an item is an array', function (t) {
      const { shim } = t.nr
      assert.ok(shim.isArray([]))
      assert.ok(!shim.isArray({}))
      assert.ok(!shim.isArray(arguments))
      assert.ok(!shim.isArray(function () {}))
      assert.ok(!shim.isArray(true))
      assert.ok(!shim.isArray(false))
      assert.ok(!shim.isArray('foobar'))
      assert.ok(!shim.isArray(1234))
      assert.ok(!shim.isArray(null))
      assert.ok(!shim.isArray(undefined))
    })
  })

  await t.test('#isNull', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should detect if an item is null', function (t) {
      const { shim } = t.nr
      assert.ok(shim.isNull(null))
      assert.ok(!shim.isNull({}))
      assert.ok(!shim.isNull([]))
      assert.ok(!shim.isNull(arguments))
      assert.ok(!shim.isNull(function () {}))
      assert.ok(!shim.isNull(true))
      assert.ok(!shim.isNull(false))
      assert.ok(!shim.isNull('foobar'))
      assert.ok(!shim.isNull(1234))
      assert.ok(!shim.isNull(undefined))
    })
  })

  await t.test('#toArray', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should convert array-like objects into arrays', function (t) {
      const { shim } = t.nr
      const res = ['a', 'b', 'c', 'd']
      const resToArray = shim.toArray(res)
      assert.deepEqual(resToArray, res)
      assert.ok(resToArray instanceof Array)

      const strToArray = shim.toArray('abcd')
      assert.deepEqual(strToArray, res)
      assert.ok(strToArray instanceof Array)

      argumentsTest.apply(null, res)
      function argumentsTest() {
        const argsToArray = shim.toArray(arguments)
        assert.deepEqual(argsToArray, res)
        assert.ok(argsToArray instanceof Array)
      }
    })
  })

  await t.test('#normalizeIndex', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      ctx.nr.args = [1, 2, 3, 4]
    })
    t.afterEach(afterEach)

    await t.test('should return the index if it is already normal', function (t) {
      const { args, shim } = t.nr
      assert.equal(shim.normalizeIndex(args.length, 0), 0)
      assert.equal(shim.normalizeIndex(args.length, 1), 1)
      assert.equal(shim.normalizeIndex(args.length, 3), 3)
    })

    await t.test('should offset negative indexes from the end of the array', function (t) {
      const { args, shim } = t.nr
      assert.equal(shim.normalizeIndex(args.length, -1), 3)
      assert.equal(shim.normalizeIndex(args.length, -2), 2)
      assert.equal(shim.normalizeIndex(args.length, -4), 0)
    })

    await t.test('should return `null` for invalid indexes', function (t) {
      const { args, shim } = t.nr
      assert.equal(shim.normalizeIndex(args.length, 4), null)
      assert.equal(shim.normalizeIndex(args.length, 10), null)
      assert.equal(shim.normalizeIndex(args.length, -5), null)
      assert.equal(shim.normalizeIndex(args.length, -10), null)
    })
  })

  await t.test('#defineProperty', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create an enumerable, configurable property', function (t) {
      const { shim } = t.nr
      const obj = {}
      shim.defineProperty(obj, 'foo', 'bar')
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      assert.equal(descriptor.configurable, true)
      assert.equal(descriptor.enumerable, true)
    })

    await t.test(
      'should create an unwritable property when `value` is not a function',
      function (t) {
        const { shim } = t.nr
        const obj = {}
        shim.defineProperty(obj, 'foo', 'bar')
        const descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

        assert.ok(!descriptor.writable)
        assert.ok(!descriptor.get)
        assert.equal(descriptor.value, 'bar')
      }
    )

    await t.test('should create a getter when `value` is a function', function (t) {
      const { shim } = t.nr
      const obj = {}
      shim.defineProperty(obj, 'foo', function () {
        return 'bar'
      })
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      assert.equal(descriptor.configurable, true)
      assert.equal(descriptor.enumerable, true)
      assert.ok(descriptor.get instanceof Function)
      assert.ok(!descriptor.value)
    })
  })

  await t.test('#defineProperties', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create properties for each key on `props`', function (t) {
      const { shim } = t.nr
      const obj = {}
      const props = { foo: 'bar', fiz: 'bang' }
      shim.defineProperties(obj, props)

      assert.equal(obj.foo, 'bar')
      assert.equal(obj.fiz, 'bang')
    })
  })

  await t.test('#setDefaults', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should copy over defaults when provided object is null', function (t) {
      const { shim } = t.nr
      const obj = null
      const defaults = { foo: 1, bar: 2 }
      const defaulted = shim.setDefaults(obj, defaults)

      assert.notEqual(obj, defaults)
      assert.notEqual(obj, defaulted)
      assert.deepEqual(defaulted, defaults)
    })

    await t.test('should copy each key over', function (t) {
      const { shim } = t.nr
      const obj = {}
      const defaults = { foo: 1, bar: 2 }
      const defaulted = shim.setDefaults(obj, defaults)

      assert.equal(obj, defaulted)
      assert.notEqual(obj, defaults)
      assert.deepEqual(defaulted, defaults)
    })

    await t.test('should update existing if existing is null', function (t) {
      const { shim } = t.nr
      const obj = { foo: null }
      const defaults = { foo: 1, bar: 2 }
      const defaulted = shim.setDefaults(obj, defaults)

      assert.equal(obj, defaulted)
      assert.notEqual(obj, defaults)
      assert.deepEqual(defaulted, { foo: 1, bar: 2 })
    })
  })

  await t.test('#proxy', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      ctx.nr.original = { foo: 1, bar: 2, biz: 3, baz: 4 }
      ctx.nr.proxied = {}
    })

    t.afterEach(afterEach)

    await t.test('should proxy individual properties', function (t) {
      const { original, proxied, shim } = t.nr
      shim.proxy(original, 'foo', proxied)
      assert.equal(original.foo, 1)
      assert.equal(proxied.foo, 1)
      assert.ok(!proxied.bar)
      assert.ok(!proxied.biz)

      proxied.foo = 'other'
      assert.equal(original.foo, 'other')
    })

    await t.test('should proxy arrays of properties', function (t) {
      const { original, proxied, shim } = t.nr
      shim.proxy(original, ['foo', 'bar'], proxied)
      assert.equal(original.foo, 1)
      assert.equal(original.bar, 2)
      assert.equal(proxied.foo, 1)
      assert.equal(proxied.bar, 2)
      assert.ok(!proxied.biz)

      proxied.foo = 'other'
      assert.equal(original.foo, 'other')
      assert.equal(original.bar, 2)

      proxied.bar = 'another'
      assert.equal(original.foo, 'other')
      assert.equal(original.bar, 'another')
    })
  })

  await t.test('assignOriginal', async (t) => {
    const mod = 'originalShimTests'

    t.beforeEach((ctx) => {
      beforeEach(ctx)
      const { agent } = ctx.nr
      ctx.nr.shim = new Shim(agent, mod, mod)
    })
    t.afterEach(afterEach)

    await t.test('should assign shim id to wrapped item as symbol', (t) => {
      const { shim } = t.nr
      const wrapped = function wrapped() {}
      const original = function original() {}
      shim.assignOriginal(wrapped, original)
      assert.equal(wrapped[symbols.wrapped], shim.id)
    })

    await t.test('should assign original on wrapped item as symbol', (t) => {
      const { shim } = t.nr
      const wrapped = function wrapped() {}
      const original = function original() {}
      shim.assignOriginal(wrapped, original)
      assert.equal(wrapped[symbols.original], original)
    })

    await t.test('should should overwrite original when forceOrig is true', (t) => {
      const { shim } = t.nr
      const wrapped = function wrapped() {}
      const original = function original() {}
      const firstOriginal = function firstOriginal() {}
      wrapped[symbols.original] = firstOriginal
      shim.assignOriginal(wrapped, original, true)
      assert.equal(wrapped[symbols.original], original)
    })

    await t.test('should not assign original if symbol already exists on wrapped item', (t) => {
      const { shim } = t.nr
      const wrapped = function wrapped() {}
      const original = function original() {}
      const firstOriginal = function firstOriginal() {}
      wrapped[symbols.original] = firstOriginal
      shim.assignOriginal(wrapped, original)
      assert.notEqual(wrapped[symbols.original], original)
      assert.equal(wrapped[symbols.original], firstOriginal)
    })
  })

  await t.test('assignId', async (t) => {
    const mod1 = 'mod1'
    const mod2 = 'mod2'

    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should assign an id to a shim instance', (t) => {
      const { agent } = t.nr
      const shim = new Shim(agent, mod1, mod1)
      assert.ok(shim.id)
    })

    await t.test(
      'should associate same id to a different shim instance when shimName matches',
      (t) => {
        const { agent } = t.nr
        const shim = new Shim(agent, mod1, mod1, mod1)
        const shim2 = new Shim(agent, mod2, mod2, mod1)
        assert.equal(shim.id, shim2.id, 'ids should be the same')
      }
    )

    await t.test('should not associate id when shimName does not match', (t) => {
      const { agent } = t.nr
      const shim = new Shim(agent, mod1, mod1, mod1)
      const shim2 = new Shim(agent, mod2, mod2, mod2)
      assert.notEqual(shim.id, shim2.id, 'ids should not be the same')
    })
  })

  await t.test('prefixRouteParameters', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not prefix parameters when given invalid input', (t) => {
      const { shim } = t.nr
      const resultNull = shim.prefixRouteParameters(null)
      assert.equal(resultNull, undefined)

      const resultString = shim.prefixRouteParameters('parameters')
      assert.equal(resultString, undefined)
    })

    await t.test('should return the object with route param prefix applied to keys', (t) => {
      const { shim } = t.nr
      const result = shim.prefixRouteParameters({ id: '123abc', foo: 'bar' })
      assert.deepEqual(result, {
        'request.parameters.route.id': '123abc',
        'request.parameters.route.foo': 'bar'
      })
    })
  })

  await t.test('getOriginalOnce', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should return the function on original symbol', (t) => {
      const { shim, wrappable } = t.nr
      const orig = wrappable.bar
      shim.wrap(wrappable, 'bar', function wrapBar(_shim, fn) {
        return function wrappedBar() {
          const ret = fn.apply(this, arguments)
          return `${ret} wrapped`
        }
      })

      assert.deepEqual(orig, shim.getOriginalOnce(wrappable.bar), 'should get original')
    })

    await t.test(
      'should return the function on original symbol for a given property of a module',
      (t) => {
        const { shim, wrappable } = t.nr
        const orig = wrappable.bar
        shim.wrap(wrappable, 'bar', function wrapBar(_shim, fn) {
          return function wrappedBar() {
            const ret = fn.apply(this, arguments)
            return `${ret} wrapped`
          }
        })

        assert.deepEqual(orig, shim.getOriginalOnce(wrappable, 'bar'), 'should get original')
      }
    )

    await t.test('should not return original if wrapped twice', (t) => {
      const { shim, wrappable } = t.nr
      const orig = wrappable.bar
      shim.wrap(wrappable, 'bar', function wrapBar(_shim, fn) {
        return function wrappedBar() {
          const ret = fn.apply(this, arguments)
          return `${ret} wrapped`
        }
      })

      shim.wrap(wrappable, 'bar', function wrapBar2(_shim, fn) {
        return function wrappedBar2() {
          const ret = fn.apply(this, arguments)
          return `${ret} wrapped`
        }
      })

      const notOrig = shim.getOriginalOnce(wrappable.bar)
      assert.notEqual(orig, notOrig, 'should not be original but first wrapped')
      assert.equal(notOrig.name, 'wrappedBar', 'should be the first wrapped function name')
    })

    await t.test('should not return if module is undefined', (t) => {
      const { shim } = t.nr
      const nodule = undefined
      assert.equal(shim.getOriginalOnce(nodule), undefined)
    })
  })

  await t.test('getOriginal', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should return the function on original symbol', (t) => {
      const { shim, wrappable } = t.nr
      const orig = wrappable.bar
      shim.wrap(wrappable, 'bar', function wrapBar(_shim, fn) {
        return function wrappedBar() {
          const ret = fn.apply(this, arguments)
          return `${ret} wrapped`
        }
      })

      shim.wrap(wrappable, 'bar', function wrapBar2(_shim, fn) {
        return function wrappedBar2() {
          const ret = fn.apply(this, arguments)
          return `${ret} wrapped`
        }
      })

      assert.deepEqual(orig, shim.getOriginal(wrappable.bar), 'should get original')
    })

    await t.test(
      'should return the function on original symbol for a given property of a module',
      (t) => {
        const { shim, wrappable } = t.nr
        const orig = wrappable.bar
        shim.wrap(wrappable, 'bar', function wrapBar(_shim, fn) {
          return function wrappedBar() {
            const ret = fn.apply(this, arguments)
            return `${ret} wrapped`
          }
        })

        shim.wrap(wrappable, 'bar', function wrapBar2(_shim, fn) {
          return function wrappedBar2() {
            const ret = fn.apply(this, arguments)
            return `${ret} wrapped`
          }
        })

        assert.deepEqual(orig, shim.getOriginal(wrappable, 'bar'), 'should get original')
      }
    )

    await t.test('should not return if module is undefined', (t) => {
      const { shim } = t.nr
      const nodule = undefined
      assert.equal(shim.getOriginal(nodule), undefined)
    })
  })

  await t.test('_moduleRoot', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.loadMockedAgent()
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should set _moduleRoot to `.` if resolvedName is a built-in', (t) => {
      const { agent } = t.nr
      const shim = new Shim(agent, 'http', 'http')
      assert.equal(shim._moduleRoot, '.')
    })

    await t.test(
      'should set _moduleRoot to `.` if resolvedName is undefined but moduleName  is a built-in',
      (t) => {
        const { agent } = t.nr
        const shim = new Shim(agent, 'http')
        assert.equal(shim._moduleRoot, '.')
      }
    )

    await t.test('should set _moduleRoot to resolvedName not a built-in', (t) => {
      const { agent } = t.nr
      const root = '/path/to/app/node_modules/rando-mod'
      const shim = new Shim(agent, 'rando-mod', root)
      assert.equal(shim._moduleRoot, root)
    })

    await t.test('should properly resolve _moduleRoot as windows path', (t) => {
      const { agent } = t.nr
      const root = 'c:\\path\\to\\app\\node_modules\\@scope\\test'
      const shim = new Shim(agent, '@scope/test', root)
      assert.equal(shim._moduleRoot, root)
    })
  })

  await t.test('shim.specs', (t) => {
    const agent = helper.loadMockedAgent()
    t.after(() => {
      helper.unloadAgent(agent)
    })

    const shim = new Shim(agent, 'test-mod')
    assert.ok(shim.specs, 'should assign specs to an instance of shim')
    assert.ok(shim.specs.ClassWrapSpec)
    assert.ok(shim.specs.MessageSpec)
    assert.ok(shim.specs.MessageSubscribeSpec)
    assert.ok(shim.specs.MiddlewareMounterSpec)
    assert.ok(shim.specs.MiddlewareSpec)
    assert.ok(shim.specs.OperationSpec)
    assert.ok(shim.specs.QuerySpec)
    assert.ok(shim.specs.RecorderSpec)
    assert.ok(shim.specs.RenderSpec)
    assert.ok(shim.specs.SegmentSpec)
    assert.ok(shim.specs.TransactionSpec)
    assert.ok(shim.specs.WrapSpec)
    assert.ok(shim.specs.params.DatastoreParameters)
    assert.ok(shim.specs.params.QueueMessageParameters)
  })

  await t.test('should not use functions in MessageSubscribeSpec if it is not an array', (t) => {
    const agent = helper.loadMockedAgent()
    t.after(() => {
      helper.unloadAgent(agent)
    })

    const shim = new Shim(agent, 'test-mod')
    const spec = new shim.specs.MessageSubscribeSpec({
      functions: 'foo-bar'
    })
    assert.ok(!spec.functions)
  })
})
