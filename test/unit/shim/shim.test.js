/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { EventEmitter } = require('events')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')
const symbols = require('../../../lib/symbols')
const { RecorderSpec } = require('../../../lib/shim/specs')

tap.test('Shim', function (t) {
  t.autoend()
  let agent = null
  let contextManager = null
  let shim = null
  let wrappable = null

  function beforeEach() {
    agent = helper.loadMockedAgent()
    contextManager = helper.getContextManager()
    shim = new Shim(agent, 'test-module')
    wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() {
        return 'fiz'
      },
      anony: function () {},
      getActiveSegment: function () {
        return contextManager.getContext()
      }
    }
  }

  function afterEach() {
    helper.unloadAgent(agent)
    agent = null
    contextManager = null
    shim = null
  }

  /**
   * Helper that verifies the original callback
   * and wrapped callback are the same
   */
  function checkNotWrapped(cb, wrappedCB) {
    this.equal(wrappedCB, cb)
    this.notOk(shim.isWrapped(wrappedCB))
    this.end()
  }

  t.test('constructor', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should require an agent parameter', function (t) {
      t.throws(function () {
        return new Shim()
      })
      t.end()
    })

    t.test('should require a module name parameter', function (t) {
      t.throws(function () {
        return new Shim(agent)
      })
      t.end()
    })

    t.test('should assign properties from parent', (t) => {
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new Shim(agent, mod, mod, name, version)
      t.equal(shim.moduleName, mod)
      t.equal(agent, shim._agent)
      t.equal(shim.pkgVersion, version)
      t.end()
    })
  })

  t.test('.defineProperty', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should create a non-writable property', function (t) {
      const foo = {}
      Shim.defineProperty(foo, 'bar', 'foobar')
      t.equal(foo.bar, 'foobar')
      t.isNonWritable({ obj: foo, key: 'bar', value: 'foobar' })
      t.end()
    })

    t.test('should create a getter', function (t) {
      const foo = {}
      let getterCalled = false
      Shim.defineProperty(foo, 'bar', function () {
        getterCalled = true
        return 'foobar'
      })

      t.notOk(getterCalled)
      t.equal(foo.bar, 'foobar')
      t.ok(getterCalled)
      t.end()
    })
  })

  t.test('.defineProperties', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should create all the properties specified', function (t) {
      const foo = {}
      Shim.defineProperties(foo, {
        bar: 'foobar',
        fiz: function () {
          return 'bang'
        }
      })

      t.same(Object.keys(foo), ['bar', 'fiz'])
      t.end()
    })
  })

  t.test('#FIRST through #LAST', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    const keys = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST']

    keys.forEach((key, i) => {
      t.test(`${key} should be a non-writable property`, function (t) {
        t.isNonWritable({ obj: shim, key })
        t.end()
      })

      t.test(`${key} should be an array index value`, function (t) {
        t.equal(shim[key], key === 'LAST' ? -1 : i)
        t.end()
      })
    })
  })

  t.test('#agent', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should be a non-writable property', function (t) {
      t.isNonWritable({ obj: shim, key: 'agent', value: agent })
      t.end()
    })

    t.test('should be the agent handed to the constructor', function (t) {
      const foo = {}
      const s = new Shim(foo, 'test-module')
      t.equal(s.agent, foo)
      t.end()
    })
  })

  t.test('#tracer', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should be a non-writable property', function (t) {
      t.isNonWritable({ obj: shim, key: 'tracer', value: agent.tracer })
      t.end()
    })

    t.test('should be the tracer from the agent', function (t) {
      const foo = { tracer: {} }
      const s = new Shim(foo, 'test-module')
      t.equal(s.tracer, foo.tracer)
      t.end()
    })
  })

  t.test('#moduleName', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should be a non-writable property', function (t) {
      t.isNonWritable({ obj: shim, key: 'moduleName', value: 'test-module' })
      t.end()
    })

    t.test('should be the name handed to the constructor', function (t) {
      const s = new Shim(agent, 'some-module-name')
      t.equal(s.moduleName, 'some-module-name')
      t.end()
    })
  })

  t.test('#logger', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should be a non-writable property', function (t) {
      t.isNonWritable({ obj: shim, key: 'logger' })
      t.end()
    })

    t.test('should be a logger to use with the shim', function (t) {
      t.ok(shim.logger.trace instanceof Function)
      t.ok(shim.logger.debug instanceof Function)
      t.ok(shim.logger.info instanceof Function)
      t.ok(shim.logger.warn instanceof Function)
      t.ok(shim.logger.error instanceof Function)
      t.end()
    })
  })

  t.test('#wrap', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should call the spec with the to-be-wrapped item', function (t) {
      shim.wrap(wrappable, function (_shim, toWrap, name) {
        t.equal(_shim, shim)
        t.equal(toWrap, wrappable)
        t.equal(name, wrappable.name)
        t.end()
      })
    })

    t.test('should match the arity and name of the original when specified', function (t) {
      // eslint-disable-next-line no-unused-vars
      function toWrap(a, b) {}
      const wrapped = shim.wrap(toWrap, {
        wrapper: function () {
          return function wrappedFn() {}
        },
        matchArity: true
      })
      t.not(wrapped, toWrap)
      t.equal(wrapped.length, toWrap.length)
      t.equal(wrapped.name, toWrap.name)
      t.end()
    })

    t.test('should pass items in the `args` parameter to the spec', function (t) {
      /* eslint-disable max-params */
      shim.wrap(
        wrappable,
        function (_shim, toWrap, name, arg1, arg2, arg3) {
          t.equal(arguments.length, 6)
          t.equal(arg1, 'a')
          t.equal(arg2, 'b')
          t.equal(arg3, 'c')
          t.end()
        },
        ['a', 'b', 'c']
      )
      /* eslint-enable max-params */
    })

    t.test('should wrap the first parameter', function (t) {
      shim.wrap(wrappable, function (_, toWrap) {
        t.equal(toWrap, wrappable)
        t.end()
      })
    })

    t.test('should wrap the first parameter when properties is `null`', function (t) {
      shim.wrap(wrappable, null, function (_, toWrap) {
        t.equal(toWrap, wrappable)
        t.end()
      })
    })

    t.test('should mark the first parameter as wrapped', function (t) {
      const wrapped = shim.wrap(wrappable, function (_, toWrap) {
        return { wrappable: toWrap }
      })

      t.not(wrapped, wrappable)
      t.equal(wrapped.wrappable, wrappable)
      t.ok(shim.isWrapped(wrapped))
      t.end()
    })
  })

  t.test('#wrap with properties', function (t) {
    let barTestWrapper = null
    let originalBar = null
    let ret = null
    t.autoend()

    t.beforeEach(function () {
      beforeEach()
      barTestWrapper = function () {}
      originalBar = wrappable.bar
      ret = shim.wrap(wrappable, 'bar', function () {
        return barTestWrapper
      })
    })

    t.afterEach(afterEach)

    t.test('should accept a single property', function (t) {
      const originalFiz = wrappable.fiz
      shim.wrap(wrappable, 'fiz', function (_, toWrap, name) {
        t.equal(toWrap, wrappable.fiz)
        t.equal(name, 'fiz', 'should use property as name')
      })

      t.equal(ret, wrappable)
      t.equal(wrappable.fiz, originalFiz, 'should not replace unwrapped')
      t.end()
    })

    t.test('should accept an array of properties', function (t) {
      let specCalled = 0
      shim.wrap(wrappable, ['fiz', 'anony'], function (_, toWrap, name) {
        ++specCalled
        if (specCalled === 1) {
          t.equal(toWrap, wrappable.fiz)
          t.equal(name, 'fiz')
        } else if (specCalled === 2) {
          t.equal(toWrap, wrappable.anony)
          t.equal(name, 'anony')
        }
      })

      t.equal(specCalled, 2)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      t.not(wrappable.bar, originalBar)
      t.end()
    })

    t.test('should mark wrapped properties as such', function (t) {
      t.ok(shim.isWrapped(wrappable, 'bar'))
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      t.notOk(shim.isWrapped(wrappable, 'fiz'))
      t.end()
    })
  })

  t.test('with a function', function (t) {
    t.autoend()
    let wrapper = null

    t.beforeEach(function () {
      beforeEach()
      wrapper = function wrapperFunc() {
        return function wrapped() {}
      }
      shim.wrap(wrappable, 'bar', wrapper)
    })

    t.afterEach(afterEach)

    t.test('should not maintain the name', function (t) {
      t.equal(wrappable.bar.name, 'wrapped')
      t.end()
    })

    t.test('should not maintain the arity', function (t) {
      t.equal(wrappable.bar.length, 0)
      t.end()
    })
  })

  t.test('#bindSegment', function (t) {
    t.autoend()
    let segment
    let startingSegment

    t.beforeEach(function () {
      beforeEach()

      segment = {
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

      startingSegment = contextManager.getContext()
    })

    t.afterEach(afterEach)

    t.test('should not wrap non-functions', function (t) {
      shim.bindSegment(wrappable, 'name')
      t.notOk(shim.isWrapped(wrappable, 'name'))
      t.end()
    })

    t.test('should not error if `nodule` is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.bindSegment(null, 'foobar', segment)
      })
      t.end()
    })

    t.test('should wrap the first parameter if `property` is not given', function (t) {
      const wrapped = shim.bindSegment(wrappable.getActiveSegment, segment)

      t.not(wrapped, wrappable.getActiveSegment)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.getActiveSegment)
      t.end()
    })

    t.test('should wrap the first parameter if `property` is `null`', function (t) {
      const wrapped = shim.bindSegment(wrappable.getActiveSegment, null, segment)

      t.not(wrapped, wrappable.getActiveSegment)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.getActiveSegment)
      t.end()
    })

    t.test('should not wrap the function at all with no segment', function (t) {
      const wrapped = shim.bindSegment(wrappable.getActiveSegment)
      t.equal(wrapped, wrappable.getActiveSegment)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should be safe to pass a full param with not segment', function (t) {
      const wrapped = shim.bindSegment(wrappable.getActiveSegment, null, true)
      t.equal(wrapped, wrappable.getActiveSegment)
      t.notOk(shim.isWrapped(wrapped))
      t.doesNotThrow(wrapped)
      t.end()
    })

    t.test('should make the given segment active while executing', function (t) {
      t.not(startingSegment, segment, 'test should start in clean condition')

      shim.bindSegment(wrappable, 'getActiveSegment', segment)
      t.equal(contextManager.getContext(), startingSegment)
      t.equal(wrappable.getActiveSegment(), segment)
      t.equal(contextManager.getContext(), startingSegment)
      t.end()
    })

    t.test('should not require any arguments except a function', function (t) {
      t.not(startingSegment, segment, 'test should start in clean condition')

      // bindSegment will not wrap if there is no segment active and
      // no segment is passed in.  To get around this we set the
      // active segment to an object known not to be null then do the
      // wrapping.
      contextManager.setContext(segment)
      const wrapped = shim.bindSegment(wrappable.getActiveSegment)
      contextManager.setContext(startingSegment)

      t.equal(wrapped(), segment)
      t.equal(contextManager.getContext(), startingSegment)
      t.end()
    })

    t.test('should default `full` to false', function (t) {
      shim.bindSegment(wrappable, 'getActiveSegment', segment)
      wrappable.getActiveSegment()

      t.notOk(segment.started)
      t.notOk(segment.touched)
      t.end()
    })

    t.test('should start and touch the segment if `full` is `true`', function (t) {
      shim.bindSegment(wrappable, 'getActiveSegment', segment, true)
      wrappable.getActiveSegment()

      t.ok(segment.started)
      t.ok(segment.touched)
      t.end()
    })

    t.test('should default to the current segment', function (t) {
      contextManager.setContext(segment)
      shim.bindSegment(wrappable, 'getActiveSegment')
      const activeSegment = wrappable.getActiveSegment()
      t.equal(activeSegment, segment)
      t.end()
    })
  })

  t.test('#wrapReturn', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      shim.wrapReturn(wrappable, 'name', function () {})
      t.notOk(shim.isWrapped(wrappable, 'name'))
      t.end()
    })

    t.test('should not blow up when wrapping a non-object prototype', function (t) {
      function noProto() {}
      noProto.prototype = undefined
      const instance = shim.wrapReturn(noProto, function () {}).bind({})
      t.doesNotThrow(instance)
      t.end()
    })

    t.test('should not blow up when wrapping a non-object prototype, null bind', function (t) {
      function noProto() {}
      noProto.prototype = undefined
      const instance = shim.wrapReturn(noProto, function () {}).bind(null)
      t.doesNotThrow(instance)
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.wrapReturn(wrappable.bar, function () {})

      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.wrapReturn(wrappable.bar, null, function () {})

      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.wrapReturn(wrappable, 'bar', function () {})

      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable, 'bar'))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should wrap child instance properly', function (t) {
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
      t.ok(typeof child.childMethod === 'function', 'should have child methods')
      t.ok(typeof child.parentMethod === 'function', 'should have parent methods')
      t.end()
    })
  })

  t.test('#wrapReturn wrapper', function (t) {
    t.autoend()
    let executed
    let toWrap
    let returned

    t.beforeEach(function () {
      beforeEach()
      executed = false
      toWrap = {
        foo: function () {
          executed = true
          returned = {
            context: this,
            args: shim.toArray(arguments)
          }
          return returned
        }
      }
    })
    t.afterEach(afterEach)

    t.test('should execute the wrapped function', function (t) {
      shim.wrapReturn(toWrap, 'foo', function () {})
      const res = toWrap.foo('a', 'b', 'c')
      t.ok(executed)
      t.equal(res.context, toWrap)
      t.same(res.args, ['a', 'b', 'c'])
      t.end()
    })

    t.test('should pass properties through', function (t) {
      const original = toWrap.foo
      original.testSymbol = Symbol('test')
      shim.wrapReturn(toWrap, 'foo', function () {})

      // wrapper is not the same function reference
      t.not(original, toWrap.foo)
      // set on original
      t.equal(toWrap.foo.testSymbol, original.testSymbol)
      t.end()
    })

    t.test('should pass assignments to the wrapped method', function (t) {
      const original = toWrap.foo
      shim.wrapReturn(toWrap, 'foo', function () {})
      toWrap.foo.testProp = 1

      // wrapper is not the same function reference
      t.not(original, toWrap.foo)
      // set via wrapper
      t.equal(original.testProp, 1)
      t.end()
    })

    t.test('should pass defined properties to the wrapped method', function (t) {
      const original = toWrap.foo
      shim.wrapReturn(toWrap, 'foo', function () {})
      Object.defineProperty(toWrap.foo, 'testDefProp', { value: 4 })

      // wrapper is not the same function reference
      t.not(original, toWrap.foo)
      // set with defineProperty via wrapper
      t.equal(original.testDefProp, 4)
      t.end()
    })

    t.test('should have the same key enumeration', function (t) {
      const original = toWrap.foo
      original.testSymbol = Symbol('test')
      shim.wrapReturn(toWrap, 'foo', function () {})
      toWrap.foo.testProp = 1

      // wrapper is not the same function reference
      t.not(original, toWrap.foo)
      // should have the same keys
      t.same(Object.keys(original), Object.keys(toWrap.foo))
      t.end()
    })

    t.test('should call the spec with returned value', function (t) {
      let specExecuted = false
      shim.wrapReturn(toWrap, 'foo', function (_, fn, name, ret) {
        specExecuted = true
        t.equal(ret, returned)
      })

      toWrap.foo()
      t.ok(specExecuted)
      t.end()
    })

    t.test('should invoke the spec in the context of the wrapped function', function (t) {
      shim.wrapReturn(toWrap, 'foo', function () {
        t.equal(this, toWrap)
      })

      toWrap.foo()
      t.end()
    })

    t.test('should invoke the spec with `new` if itself is invoked with `new`', function (t) {
      function Foo() {
        t.ok(this instanceof Foo)
      }

      Foo.prototype.method = function () {}
      const WrappedFoo = shim.wrapReturn(Foo, function () {
        t.ok(this instanceof Foo)
      })

      const foo = new WrappedFoo()
      t.ok(foo instanceof Foo)
      t.ok(foo instanceof WrappedFoo)
      t.ok(typeof foo.method === 'function')
      t.end()
    })

    t.test('should pass items in the `args` parameter to the spec', function (t) {
      /* eslint-disable max-params */
      shim.wrapReturn(
        toWrap,
        'foo',
        function (_, fn, name, ret, a, b, c) {
          t.equal(arguments.length, 7)
          t.equal(a, 'a')
          t.equal(b, 'b')
          t.equal(c, 'c')
        },
        ['a', 'b', 'c']
      )
      /* eslint-enable max-params */

      toWrap.foo()
      t.end()
    })
  })

  t.test('#wrapClass', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      shim.wrapClass(wrappable, 'name', function () {})
      t.notOk(shim.isWrapped(wrappable, 'name'))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.wrapClass(wrappable.bar, function () {})

      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.wrapClass(wrappable.bar, null, function () {})

      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.wrapClass(wrappable, 'bar', function () {})

      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable, 'bar'))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })
  })

  t.test('#wrapClass wrapper', function (t) {
    t.autoend()
    let executed = null
    let toWrap = null
    let original = null

    t.beforeEach(function () {
      beforeEach()
      executed = false
      toWrap = {
        Foo: function () {
          this.executed = executed = true
          this.context = this
          this.args = shim.toArray(arguments)
        }
      }
      original = toWrap.Foo
    })
    t.afterEach(afterEach)

    t.test('should execute the wrapped function', function (t) {
      shim.wrapClass(toWrap, 'Foo', function () {})
      const res = new toWrap.Foo('a', 'b', 'c')
      t.ok(executed)
      t.equal(res.context, res)
      t.same(res.args, ['a', 'b', 'c'])
      t.end()
    })

    t.test('should call the hooks in the correct order', function (t) {
      let preExecuted = false
      let postExecuted = false
      shim.wrapClass(toWrap, 'Foo', {
        pre: function () {
          preExecuted = true
          t.not(this)
        },
        post: function () {
          postExecuted = true
          t.ok(this.executed)
          t.ok(this instanceof toWrap.Foo)
          t.ok(this instanceof original)
        }
      })

      const foo = new toWrap.Foo()
      t.ok(preExecuted)
      t.ok(foo.executed)
      t.ok(postExecuted)
      t.end()
    })

    t.test('should pass items in the `args` parameter to the spec', function (t) {
      /* eslint-disable max-params */
      shim.wrapClass(
        toWrap,
        'Foo',
        function (_, fn, name, args, a, b, c) {
          t.equal(arguments.length, 7)
          t.equal(a, 'a')
          t.equal(b, 'b')
          t.equal(c, 'c')
        },
        ['a', 'b', 'c']
      )
      /* eslint-enable max-params */

      const foo = new toWrap.Foo()
      t.ok(foo)
      t.end()
    })
  })

  t.test('#wrapExport', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should execute the given wrap function', function (t) {
      let executed = false
      shim.wrapExport({}, function () {
        executed = true
      })
      t.ok(executed)
      t.end()
    })

    t.test('should store the wrapped version for later retrival', function (t) {
      const original = {}
      const wrapped = shim.wrapExport(original, function () {
        return {}
      })

      const xport = shim.getExport()
      t.equal(xport, wrapped)
      t.not(xport, original)
      t.end()
    })
  })

  t.test('#record', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.record(wrappable, function () {})
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.record(wrappable.bar, function () {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.record(wrappable.bar, null, function () {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.record(wrappable, 'bar', function () {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.record(wrappable, 'name', function () {})
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should not create a child segment', function (t) {
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'internal test segment', internal: true })
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = contextManager.getContext()
        startingSegment.internal = true
        startingSegment.shim = shim
        const segment = wrappable.getActiveSegment()
        t.equal(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'ROOT')
        t.equal(contextManager.getContext(), startingSegment)
        t.end()
      })
    })

    t.test('should still bind the callback', function (t) {
      const wrapped = shim.record(
        function (cb) {
          t.ok(shim.isWrapped(cb))
          t.end()
        },
        function () {
          return new RecorderSpec({ name: 'test segment', internal: true, callback: shim.LAST })
        }
      )

      helper.runInTransaction(agent, function () {
        const startingSegment = contextManager.getContext()
        startingSegment.internal = true
        startingSegment.shim = shim
        wrapped(function () {})
      })
    })

    t.test('should not throw when using an ended segment as parent', function (t) {
      helper.runInTransaction(agent, function (tx) {
        tx.end()
        const wrapped = shim.record(
          function (cb) {
            t.notOk(shim.isWrapped(cb))
            t.equal(agent.getTransaction(), null)
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
        t.doesNotThrow(function () {
          wrapped(function () {})
        })
        t.end()
      })
    })

    t.test('should call after hook on record when function is done executing', function (t) {
      helper.runInTransaction(agent, function () {
        function testAfter() {
          return 'result'
        }
        const wrapped = shim.record(testAfter, function () {
          return new RecorderSpec({
            name: 'test segment',
            callback: shim.LAST,
            after(args) {
              t.equal(Object.keys(args).length, 6, 'should have 6 args to after hook')
              const { fn, name, error, result, segment } = args
              t.equal(segment.name, 'test segment')
              t.not(error)
              t.same(fn, testAfter)
              t.equal(name, testAfter.name)
              t.equal(result, 'result')
            }
          })
        })
        t.doesNotThrow(function () {
          wrapped()
        })
        t.end()
      })
    })

    t.test(
      'should call after hook on record when the function is done executing after failure',
      function (t) {
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
                t.equal(Object.keys(args).length, 6, 'should have 6 args to after hook')
                const { fn, name, error, result, segment } = args
                t.equal(segment.name, 'test segment')
                t.same(error, err)
                t.equal(result, undefined)
                t.same(fn, testAfter)
                t.equal(name, testAfter.name)
              }
            })
          })
          t.throws(function () {
            wrapped()
          })
          t.end()
        })
      }
    )
  })

  t.test('#record with a stream', function (t) {
    t.autoend()
    let stream = null
    let toWrap = null

    t.beforeEach(function () {
      beforeEach()
      stream = new EventEmitter()
      toWrap = function () {
        stream.segment = contextManager.getContext()
        return stream
      }
    })

    t.afterEach(function () {
      afterEach()
      stream = null
      toWrap = null
    })

    t.test('should make the segment translucent when `end` is emitted', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true, opaque: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.equal(ret, stream)
      })

      t.ok(stream.segment.opaque)
      setTimeout(function () {
        stream.emit('end')
        t.notOk(stream.segment.opaque)
        t.end()
      }, 5)
    })

    t.test('should touch the segment when `end` is emitted', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.equal(ret, stream)
      })

      const oldDur = stream.segment.timer.getDurationInMillis()
      setTimeout(function () {
        stream.emit('end')
        t.ok(stream.segment.timer.getDurationInMillis() > oldDur)
        t.end()
      }, 5)
    })

    t.test('should make the segment translucent when `error` is emitted', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true, opaque: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.equal(ret, stream)
      })

      stream.on('error', function () {}) // to prevent the error being thrown
      t.ok(stream.segment.opaque)
      setTimeout(function () {
        stream.emit('error', 'foobar')
        t.notOk(stream.segment.opaque)
        t.end()
      }, 5)
    })

    t.test('should touch the segment when `error` is emitted', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.equal(ret, stream)
      })

      stream.on('error', function () {}) // to prevent the error being thrown
      const oldDur = stream.segment.timer.getDurationInMillis()
      setTimeout(function () {
        stream.emit('error', 'foobar')
        t.ok(stream.segment.timer.getDurationInMillis() > oldDur)
        t.end()
      }, 5)
    })

    t.test('should throw if there are no other `error` handlers', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: true })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.equal(ret, stream)
      })

      t.throws(function () {
        stream.emit('error', new Error('foobar'))
      }, 'foobar')
      t.end()
    })

    t.test('should bind emit to a child segment', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: 'foobar' })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.equal(ret, stream)
      })

      stream.on('foobar', function () {
        const emitSegment = shim.getSegment()
        t.equal(emitSegment.parent, stream.segment)
        t.end()
      })
      stream.emit('foobar')
    })

    t.test('should create an event segment if an event name is given', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', stream: 'foobar' })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.equal(ret, stream)
      })

      // Emit the event and check the segment name.
      t.equal(stream.segment.children.length, 0)
      stream.emit('foobar')
      t.equal(stream.segment.children.length, 1)

      const [eventSegment] = stream.segment.children
      t.match(eventSegment.name, /Event callback: foobar/)
      t.equal(eventSegment.getAttributes().count, 1)

      // Emit it again and see if the name updated.
      stream.emit('foobar')
      t.equal(stream.segment.children.length, 1)
      t.equal(stream.segment.children[0], eventSegment)
      t.equal(eventSegment.getAttributes().count, 2)

      // Emit it once more and see if the name updated again.
      stream.emit('foobar')
      t.equal(stream.segment.children.length, 1)
      t.equal(stream.segment.children[0], eventSegment)
      t.equal(eventSegment.getAttributes().count, 3)
      t.end()
    })
  })

  t.test('#record with a promise', function (t) {
    t.autoend()
    let promise = null
    let toWrap = null

    t.beforeEach(function () {
      beforeEach()
      const defer = {}
      promise = new Promise(function (resolve, reject) {
        defer.resolve = resolve
        defer.reject = reject
      })
      promise.resolve = defer.resolve
      promise.reject = defer.reject

      toWrap = function () {
        promise.segment = contextManager.getContext()
        return promise
      }
    })

    t.afterEach(function () {
      afterEach()
      promise = null
      toWrap = null
    })

    t.test('should make the segment translucent when promise resolves', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true, opaque: true })
      })

      const result = {}
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret
          .then(function (val) {
            t.equal(result, val)
            t.notOk(promise.segment.opaque)
            t.end()
          })
          .catch(t.end)
      })

      t.ok(promise.segment.opaque)
      setTimeout(function () {
        promise.resolve(result)
      }, 5)
    })

    t.test('should touch the segment when promise resolves', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true })
      })

      const result = {}
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        const oldDur = promise.segment.timer.getDurationInMillis()
        t.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret
          .then(function (val) {
            t.equal(result, val)
            t.ok(promise.segment.timer.getDurationInMillis() > oldDur)
            t.end()
          })
          .catch(t.end)
      })

      setTimeout(function () {
        promise.resolve(result)
      }, 5)
    })

    t.test('should make the segment translucent when promise rejects', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true, opaque: true })
      })

      const result = {}
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret
          .then(
            function () {
              t.end(new Error('Should not have resolved!'))
            },
            function (err) {
              t.equal(err, result)
              t.notOk(promise.segment.opaque)
              t.end()
            }
          )
          .catch(t.end)
      })

      t.ok(promise.segment.opaque)
      setTimeout(function () {
        promise.reject(result)
      }, 5)
    })

    t.test('should touch the segment when promise rejects', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true })
      })

      const result = {}
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        const oldDur = promise.segment.timer.getDurationInMillis()
        t.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        ret
          .then(
            function () {
              t.end(new Error('Should not have resolved!'))
            },
            function (err) {
              t.equal(err, result)
              t.ok(promise.segment.timer.getDurationInMillis() > oldDur)
              t.end()
            }
          )
          .catch(t.end)
      })

      setTimeout(function () {
        promise.reject(result)
      }, 5)
    })

    t.test('should not affect unhandledRejection event', function (t) {
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', promise: true })
      })

      const result = {}
      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.ok(ret instanceof Object.getPrototypeOf(promise).constructor)

        process.on('unhandledRejection', function (err) {
          t.equal(err, result)
          t.end()
        })

        ret.then(() => {
          t.end(new Error('Should not have resolved'))
        })
      })

      setTimeout(function () {
        promise.reject(result)
      }, 5)
    })

    t.test('should call after hook when promise resolves', (t) => {
      const segmentName = 'test segment'
      const expectedResult = { returned: true }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({
          name: segmentName,
          promise: true,
          after(args) {
            t.equal(Object.keys(args).length, 6, 'should have 6 args to after hook')
            const { fn, name, error, result, segment } = args
            t.same(fn, toWrap)
            t.equal(name, toWrap.name)
            t.not(error)
            t.same(result, expectedResult)
            t.equal(segment.name, segmentName)
            t.end()
          }
        })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.ok(ret instanceof Object.getPrototypeOf(promise).constructor)
      })

      setTimeout(function () {
        promise.resolve(expectedResult)
      }, 5)
    })

    t.test('should call after hook when promise reject', (t) => {
      const segmentName = 'test segment'
      const expectedResult = { returned: true }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({
          name: segmentName,
          promise: true,
          after(args) {
            t.equal(Object.keys(args).length, 5, 'should have 6 args to after hook')
            const { fn, name, error, segment } = args
            t.same(fn, toWrap)
            t.equal(name, toWrap.name)
            t.same(error, expectedResult)
            t.equal(segment.name, segmentName)
            t.end()
          }
        })
      })

      helper.runInTransaction(agent, function () {
        const ret = wrapped()
        t.ok(ret instanceof Object.getPrototypeOf(promise).constructor)
      })

      setTimeout(function () {
        promise.reject(expectedResult)
      }, 5)
    })
  })

  t.test('#record wrapper when called without a transaction', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should not create a segment', function (t) {
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      const segment = wrappable.getActiveSegment()
      t.equal(segment, null)
      t.end()
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      t.notOk(executed)
      wrapped()
      t.ok(executed)
      t.end()
    })

    t.test('should still invoke the spec', function (t) {
      let executed = false
      shim.record(wrappable, 'bar', function () {
        executed = true
      })

      t.notOk(executed)
      wrappable.bar('a', 'b', 'c')
      t.ok(executed)
      t.end()
    })

    t.test('should not bind the callback if there is one', function (t) {
      const cb = function () {}
      const toWrap = function (wrappedCB) {
        t.equal(wrappedCB, cb)
        t.notOk(shim.isWrapped(wrappedCB))
        t.end()
      }

      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', callback: shim.LAST })
      })
      wrapped(cb)
    })

    t.test('should not bind the rowCallback if there is one', function (t) {
      const cb = function () {}

      const wrapped = shim.record(checkNotWrapped.bind(t, cb), function () {
        return new RecorderSpec({ name: 'test segment', rowCallback: shim.LAST })
      })
      wrapped(cb)
    })
  })

  t.test('#record wrapper when called in an active transaction', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create a segment', function (t) {
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = contextManager.getContext()
        const segment = wrappable.getActiveSegment()
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'test segment')
        t.equal(contextManager.getContext(), startingSegment)
        t.end()
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function () {
        t.notOk(executed)
        wrapped()
        t.ok(executed)
        t.end()
      })
    })

    t.test('should invoke the spec in the context of the wrapped function', function (t) {
      const original = wrappable.bar
      let executed = false
      shim.record(wrappable, 'bar', function (_, fn, name, args) {
        executed = true
        t.equal(fn, original)
        t.equal(name, 'bar')
        t.equal(this, wrappable)
        t.same(args, ['a', 'b', 'c'])
      })

      helper.runInTransaction(agent, function () {
        t.notOk(executed)
        wrappable.bar('a', 'b', 'c')
        t.ok(executed)
        t.end()
      })
    })

    t.test('should bind the callback if there is one', function (t) {
      const cb = function () {}
      const toWrap = function (wrappedCB) {
        t.not(wrappedCB, cb)
        t.ok(shim.isWrapped(wrappedCB))
        t.equal(shim.unwrap(wrappedCB), cb)

        t.doesNotThrow(function () {
          wrappedCB()
        })
        t.end()
      }

      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment', callback: shim.LAST })
      })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })

    t.test('should bind the rowCallback if there is one', function (t) {
      const cb = function () {}

      const wrapped = shim.record(helper.checkWrappedCb.bind(t, shim, cb), function () {
        return new RecorderSpec({ name: 'test segment', rowCallback: shim.LAST })
      })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })
  })

  t.test('#record wrapper when callback required', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create segment if method has callback', function (t) {
      const cb = function () {}
      const toWrap = function (wrappedCB) {
        t.not(wrappedCB, cb)
        t.ok(shim.isWrapped(wrappedCB))
        t.equal(shim.unwrap(wrappedCB), cb)

        t.doesNotThrow(function () {
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

        t.ok(resultingSegment !== parentSegment)
        t.ok(parentSegment.children.includes(resultingSegment))
        t.end()
      })
    })

    t.test('should not create segment if method missing callback', function (t) {
      const toWrap = function (wrappedCB) {
        t.notOk(wrappedCB)

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

        t.ok(resultingSegment === parentSegment)
        t.notOk(parentSegment.children.includes(resultingSegment))
        t.end()
      })
    })
  })

  t.test('#record wrapper when called with an inactive transaction', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should not create a segment', function (t) {
      shim.record(wrappable, 'getActiveSegment', function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = contextManager.getContext()
        tx.end()
        const segment = wrappable.getActiveSegment()
        t.equal(segment, startingSegment)
        t.end()
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.record(toWrap, function () {
        return new RecorderSpec({ name: 'test segment' })
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        t.notOk(executed)
        wrapped()
        t.ok(executed)
        t.end()
      })
    })

    t.test('should still invoke the spec', function (t) {
      let executed = false
      shim.record(wrappable, 'bar', function () {
        executed = true
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        wrappable.bar('a', 'b', 'c')
        t.ok(executed)
        t.end()
      })
    })

    t.test('should not bind the callback if there is one', function (t) {
      const cb = function () {}
      const wrapped = shim.record(checkNotWrapped.bind(t, cb), function () {
        return new RecorderSpec({ name: 'test segment', callback: shim.LAST })
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        wrapped(cb)
      })
    })

    t.test('should not bind the rowCallback if there is one', function (t) {
      const cb = function () {}
      const wrapped = shim.record(checkNotWrapped.bind(t, cb), function () {
        return new RecorderSpec({ name: 'test segment', rowCallback: shim.LAST })
      })

      helper.runInTransaction(agent, function (tx) {
        tx.end()
        wrapped(cb)
      })
    })
  })

  t.test('#isWrapped', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should return true if the object was wrapped', function (t) {
      const toWrap = function () {}
      t.notOk(shim.isWrapped(toWrap))

      const wrapped = shim.wrap(toWrap, function () {
        return function () {}
      })
      t.ok(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should not error if the object is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.isWrapped(null)
      })

      t.notOk(shim.isWrapped(null))
      t.end()
    })

    t.test('should return true if the property was wrapped', function (t) {
      t.notOk(shim.isWrapped(wrappable, 'bar'))

      shim.wrap(wrappable, 'bar', function () {
        return function () {}
      })
      t.ok(shim.isWrapped(wrappable, 'bar'))
      t.end()
    })

    t.test('should not error if the object is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.isWrapped(null, 'bar')
      })
      t.notOk(shim.isWrapped(null, 'bar'))
      t.end()
    })

    t.test('should not error if the property is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.isWrapped(wrappable, 'this does not exist')
      })
      t.notOk(shim.isWrapped(wrappable, 'this does not exist'))
      t.end()
    })
  })

  t.test('#unwrap', function (t) {
    t.autoend()
    let original
    let wrapped

    t.beforeEach(function () {
      beforeEach()
      original = function () {}
      wrapped = shim.wrap(original, function () {
        return function () {}
      })
      shim.wrap(wrappable, ['bar', 'fiz', 'getActiveSegment'], function () {
        return function () {}
      })
    })
    t.afterEach(afterEach)

    t.test('should not error if the item is not wrapped', function (t) {
      t.doesNotThrow(function () {
        shim.unwrap(original)
      })
      t.equal(shim.unwrap(original), original)
      t.end()
    })

    t.test('should unwrap the first parameter', function (t) {
      t.equal(shim.unwrap(wrapped), original)
      t.end()
    })

    t.test('should not error if `nodule` is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.unwrap(null)
      })
      t.end()
    })

    t.test('should accept a single property', function (t) {
      t.ok(shim.isWrapped(wrappable.bar))
      t.doesNotThrow(function () {
        shim.unwrap(wrappable, 'bar')
      })
      t.notOk(shim.isWrapped(wrappable.bar))
      t.end()
    })

    t.test('should accept an array of properties', function (t) {
      t.ok(shim.isWrapped(wrappable.bar))
      t.ok(shim.isWrapped(wrappable.fiz))
      t.ok(shim.isWrapped(wrappable.getActiveSegment))
      t.doesNotThrow(function () {
        shim.unwrap(wrappable, ['bar', 'fiz', 'getActiveSegment'])
      })
      t.notOk(shim.isWrapped(wrappable.bar))
      t.notOk(shim.isWrapped(wrappable.fiz))
      t.notOk(shim.isWrapped(wrappable.getActiveSegment))
      t.end()
    })

    t.test('should not error if a nodule is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.unwrap(null, 'bar')
      })
      t.end()
    })

    t.test('should not error if a property is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.unwrap(wrappable, 'this does not exist')
      })
      t.end()
    })
  })

  t.test('#unwrapOnce', function (t) {
    t.autoend()
    let original
    let wrapped

    t.beforeEach(function () {
      beforeEach()
      original = function () {}
      wrapped = shim.wrap(original, function () {
        return function () {}
      })
      shim.wrap(wrappable, ['bar', 'fiz', 'getActiveSegment'], function () {
        return function () {}
      })
    })
    t.afterEach(afterEach)

    t.test('should not error if the item is not wrapped', function (t) {
      t.doesNotThrow(function () {
        shim.unwrapOnce(original)
      })
      t.equal(shim.unwrapOnce(original), original)
      t.end()
    })

    t.test('should not fully unwrap multiple nested wrappers', function (t) {
      for (let i = 0; i < 10; ++i) {
        wrapped = shim.wrap(wrapped, function () {
          return function () {}
        })
      }

      t.not(wrapped, original)
      t.not(wrapped[symbols.original], original)
      t.not(shim.unwrapOnce(wrapped), original)
      t.end()
    })

    t.test('should unwrap the first parameter', function (t) {
      t.equal(shim.unwrapOnce(wrapped), original)
      t.end()
    })

    t.test('should not error if `nodule` is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.unwrapOnce(null)
      })
      t.end()
    })

    t.test('should accept a single property', function (t) {
      t.ok(shim.isWrapped(wrappable.bar))
      t.doesNotThrow(function () {
        shim.unwrapOnce(wrappable, 'bar')
      })
      t.notOk(shim.isWrapped(wrappable.bar))
      t.end()
    })

    t.test('should accept an array of properties', function (t) {
      t.ok(shim.isWrapped(wrappable.bar))
      t.ok(shim.isWrapped(wrappable.fiz))
      t.ok(shim.isWrapped(wrappable.getActiveSegment))
      t.doesNotThrow(function () {
        shim.unwrapOnce(wrappable, ['bar', 'fiz', 'getActiveSegment'])
      })
      t.notOk(shim.isWrapped(wrappable.bar))
      t.notOk(shim.isWrapped(wrappable.fiz))
      t.notOk(shim.isWrapped(wrappable.getActiveSegment))
      t.end()
    })

    t.test('should not error if a nodule is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.unwrapOnce(null, 'bar')
      })
      t.end()
    })

    t.test('should not error if a property is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.unwrapOnce(wrappable, 'this does not exist')
      })
      t.end()
    })
  })

  t.test('#getSegment', function (t) {
    t.autoend()
    let segment = null

    t.beforeEach(function () {
      beforeEach()
      segment = { probe: function () {} }
    })
    t.afterEach(afterEach)

    t.test('should return the segment a function is bound to', function (t) {
      const bound = shim.bindSegment(function () {}, segment)
      t.equal(shim.getSegment(bound), segment)
      t.end()
    })

    t.test('should return the current segment if the function is not bound', function (t) {
      contextManager.setContext(segment)
      t.equal(
        shim.getSegment(function () {}),
        segment
      )
      t.end()
    })

    t.test('should return the current segment if no object is provided', function (t) {
      contextManager.setContext(segment)
      t.equal(shim.getSegment(), segment)
      t.end()
    })
  })

  t.test('#getActiveSegment', function (t) {
    t.autoend()
    let segment = null

    t.beforeEach(function () {
      beforeEach()
      segment = {
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

    t.test(
      'should return the segment a function is bound to when transaction is active',
      function (t) {
        const bound = shim.bindSegment(function () {}, segment)
        t.equal(shim.getActiveSegment(bound), segment)
        t.end()
      }
    )

    t.test(
      'should return the current segment if the function is not bound when transaction is active',
      function (t) {
        contextManager.setContext(segment)
        t.equal(
          shim.getActiveSegment(function () {}),
          segment
        )
        t.end()
      }
    )

    t.test(
      'should return the current segment if no object is provided when transaction is active',
      function (t) {
        contextManager.setContext(segment)
        t.equal(shim.getActiveSegment(), segment)
        t.end()
      }
    )

    t.test('should return null for a bound function when transaction is not active', function (t) {
      segment.transaction.active = false
      const bound = shim.bindSegment(function () {}, segment)
      t.equal(shim.getActiveSegment(bound), null)
      t.end()
    })

    t.test(
      'should return null if the function is not bound when transaction is not active',
      function (t) {
        segment.transaction.active = false
        contextManager.setContext(segment)
        t.equal(
          shim.getActiveSegment(function () {}),
          null
        )
        t.end()
      }
    )

    t.test(
      'should return null if no object is provided when transaction is not active',
      function (t) {
        segment.transaction.active = false
        contextManager.setContext(segment)
        t.equal(shim.getActiveSegment(), null)
        t.end()
      }
    )
  })

  t.test('#storeSegment', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should store the segment on the object', function (t) {
      const segment = { probe: function () {} }
      shim.storeSegment(wrappable, segment)
      t.equal(shim.getSegment(wrappable), segment)
      t.end()
    })

    t.test('should default to the current segment', function (t) {
      const segment = { probe: function () {} }
      contextManager.setContext(segment)
      shim.storeSegment(wrappable)
      t.equal(shim.getSegment(wrappable), segment)
      t.end()
    })

    t.test('should not fail if the object is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.storeSegment(null)
      })
      t.end()
    })
  })

  t.test('#bindCallbackSegment', function (t) {
    t.autoend()
    let cbCalled = false
    let cb = null

    t.beforeEach(function () {
      beforeEach()
      cbCalled = false
      cb = function () {
        cbCalled = true
      }
    })
    t.afterEach(afterEach)

    t.test('should wrap the callback in place', function (t) {
      const args = ['a', cb, 'b']
      shim.bindCallbackSegment({}, args, shim.SECOND)

      const [, wrapped] = args
      t.ok(wrapped instanceof Function)
      t.not(wrapped, cb)
      t.same(args, ['a', wrapped, 'b'])
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), cb)
      t.end()
    })

    t.test('should work with an array and numeric index', function (t) {
      const args = ['a', cb, 'b']
      shim.bindCallbackSegment({}, args, 1)
      t.ok(shim.isWrapped(args[1]))
      t.end()
    })

    t.test('should work with an object and a string index', function (t) {
      const opts = { a: 'a', cb: cb, b: 'b' }
      shim.bindCallbackSegment({}, opts, 'cb')
      t.ok(shim.isWrapped(opts, 'cb'))
      t.end()
    })

    t.test('should not error if `args` is `null`', function (t) {
      t.doesNotThrow(function () {
        shim.bindCallbackSegment({}, null, 1)
      })
      t.end()
    })

    t.test('should not error if the callback does not exist', function (t) {
      t.doesNotThrow(function () {
        const args = ['a']
        shim.bindCallbackSegment({}, args, 1)
      })
      t.end()
    })

    t.test('should not bind if the "callback" is not a function', function (t) {
      let args
      t.doesNotThrow(function () {
        args = ['a']
        shim.bindCallbackSegment({}, args, 0)
      })

      t.notOk(shim.isWrapped(args[0]))
      t.equal(args[0], 'a')
      t.end()
    })

    t.test('should execute the callback', function (t) {
      const args = ['a', 'b', cb]
      shim.bindCallbackSegment({}, args, shim.LAST)

      t.notOk(cbCalled)
      args[2]()
      t.ok(cbCalled)
      t.end()
    })

    t.test('should create a new segment', function (t) {
      helper.runInTransaction(agent, function () {
        const args = [wrappable.getActiveSegment]
        const segment = wrappable.getActiveSegment()
        const parent = shim.createSegment('test segment')
        shim.bindCallbackSegment({}, args, shim.LAST, parent)
        const cbSegment = args[0]()

        t.not(cbSegment, segment)
        t.not(cbSegment, parent)
        t.compareSegments(parent, [cbSegment])
        t.end()
      })
    })

    t.test('should make the `parentSegment` translucent after running', function (t) {
      helper.runInTransaction(agent, function () {
        const args = [wrappable.getActiveSegment]
        const parent = shim.createSegment('test segment')
        parent.opaque = true
        shim.bindCallbackSegment({}, args, shim.LAST, parent)
        const cbSegment = args[0]()

        t.not(cbSegment, parent)
        t.compareSegments(parent, [cbSegment])
        t.notOk(parent.opaque)
        t.end()
      })
    })

    t.test('should default the `parentSegment` to the current one', function (t) {
      helper.runInTransaction(agent, function () {
        const args = [wrappable.getActiveSegment]
        const segment = wrappable.getActiveSegment()
        shim.bindCallbackSegment({}, args, shim.LAST)
        const cbSegment = args[0]()

        t.not(cbSegment, segment)
        t.compareSegments(segment, [cbSegment])
        t.end()
      })
    })

    t.test('should call the after hook if specified on the spec', function (t) {
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

        t.not(cbSegment, segment)
        t.compareSegments(segment, [cbSegment])
        t.ok(executed)
        t.end()
      })
    })
  })

  t.test('#applySegment', function (t) {
    t.autoend()
    let segment

    t.beforeEach(function () {
      beforeEach()
      segment = {
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

    t.test('should call the function with the `context` and `args`', function (t) {
      const context = { name: 'context' }
      const value = { name: 'value' }
      const ret = shim.applySegment(
        function (a, b, c) {
          t.equal(this, context)
          t.equal(arguments.length, 3)
          t.equal(a, 'a')
          t.equal(b, 'b')
          t.equal(c, 'c')
          return value
        },
        segment,
        false,
        context,
        ['a', 'b', 'c']
      )

      t.equal(ret, value)
      t.end()
    })

    t.test('should execute the inContext callback under the produced segment', function (t) {
      shim.applySegment(
        function () {},
        segment,
        false,
        {},
        [],
        function checkSegment(activeSegment) {
          t.equal(activeSegment, segment)
          t.equal(contextManager.getContext(), segment)
          t.end()
        }
      )
    })

    t.test('should make the segment active for the duration of execution', function (t) {
      const prevSegment = { name: 'prevSegment', probe: function () {} }
      contextManager.setContext(prevSegment)

      const activeSegment = shim.applySegment(wrappable.getActiveSegment, segment)
      t.equal(contextManager.getContext(), prevSegment)
      t.equal(activeSegment, segment)
      t.notOk(segment.touched)
      t.notOk(segment.started)
      t.end()
    })

    t.test('should start and touch the segment if `full` is `true`', function (t) {
      shim.applySegment(wrappable.getActiveSegment, segment, true)
      t.ok(segment.touched)
      t.ok(segment.started)
      t.end()
    })

    t.test('should not change the active segment if `segment` is `null`', function (t) {
      contextManager.setContext(segment)
      let activeSegment = null
      t.doesNotThrow(function () {
        activeSegment = shim.applySegment(wrappable.getActiveSegment, null)
      })
      t.equal(contextManager.getContext(), segment)
      t.equal(activeSegment, segment)
      t.end()
    })

    t.test('should not throw in a transaction when `func` has no `.apply` method', (t) => {
      const func = function () {}
      func.__proto__ = {}
      t.notOk(func.apply)
      t.doesNotThrow(() => shim.applySegment(func, segment))
      t.end()
    })

    t.test('should not throw out of a transaction', (t) => {
      const func = function () {}
      func.__proto__ = {}
      t.notOk(func.apply)
      t.doesNotThrow(() => shim.applySegment(func, null))
      t.end()
    })

    t.test('should not swallow the exception when `func` throws an exception', function (t) {
      const func = function () {
        throw new Error('test error')
      }

      t.throws(function () {
        shim.applySegment(func, segment)
      }, 'test error')
      t.end()
    })

    t.test(
      'should still return the active segment to the previous one when `func` throws an exception',
      function (t) {
        const func = function () {
          throw new Error('test error')
        }
        const prevSegment = { name: 'prevSegment', probe: function () {} }
        contextManager.setContext(prevSegment)

        t.throws(function () {
          shim.applySegment(func, segment)
        }, 'test error')

        t.equal(contextManager.getContext(), prevSegment)
        t.end()
      }
    )
    t.test(
      'should still touch the segment if `full` is `true` when `func` throws an exception',
      function (t) {
        const func = function () {
          throw new Error('test error')
        }
        t.throws(function () {
          shim.applySegment(func, segment, true)
        }, 'test error')

        t.ok(segment.touched)
        t.end()
      }
    )
  })

  t.test('#createSegment', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create a segment with the correct name', function (t) {
      helper.runInTransaction(agent, function () {
        const segment = shim.createSegment('foobar')
        t.equal(segment.name, 'foobar')
        t.end()
      })
    })

    t.test('should allow `recorder` to be omitted', function (t) {
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        const child = shim.createSegment('child', parent)
        t.equal(child.name, 'child')
        t.compareSegments(parent, [child])
        t.end()
      })
    })

    t.test('should allow `recorder` to be null', function (t) {
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        const child = shim.createSegment('child', null, parent)
        t.equal(child.name, 'child')
        t.compareSegments(parent, [child])
        t.end()
      })
    })

    t.test('should not create children for opaque segments', function (t) {
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        parent.opaque = true
        const child = shim.createSegment('child', parent)
        t.equal(child.name, 'parent')
        t.same(parent.children, [])
        t.end()
      })
    })

    t.test('should not modify returned parent for opaque segments', (t) => {
      helper.runInTransaction(agent, () => {
        const parent = shim.createSegment('parent')
        parent.opaque = true
        parent.internal = true

        const child = shim.createSegment('child', parent)

        t.equal(child, parent)
        t.ok(parent.opaque)
        t.ok(parent.internal)
        t.end()
      })
    })

    t.test('should default to the current segment as the parent', function (t) {
      helper.runInTransaction(agent, function () {
        const parent = shim.getSegment()
        const child = shim.createSegment('child')
        t.compareSegments(parent, [child])
        t.end()
      })
    })

    t.test('should not modify returned parent for opaque segments', (t) => {
      helper.runInTransaction(agent, () => {
        const parent = shim.createSegment('parent')
        parent.opaque = true
        parent.internal = true

        shim.setActiveSegment(parent)

        const child = shim.createSegment('child')

        t.equal(child, parent)
        t.ok(parent.opaque)
        t.ok(parent.internal)
        t.end()
      })
    })

    t.test('should work with all parameters in an object', function (t) {
      helper.runInTransaction(agent, function () {
        const parent = shim.createSegment('parent')
        const child = shim.createSegment({ name: 'child', parent })
        t.equal(child.name, 'child')
        t.compareSegments(parent, [child])
        t.end()
      })
    })
  })

  t.test('#createSegment when an `parameters` object is provided', function (t) {
    t.autoend()
    let segment = null
    let parameters = null

    t.beforeEach(function () {
      beforeEach()
      parameters = {
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
        segment = shim.createSegment({ name: 'child', parameters: parameters })
      })
    })
    t.afterEach(afterEach)

    t.test(
      'should copy parameters provided into `segment.parameters` and `attributes.enabled` is true',
      function (t) {
        t.ok(segment.attributes)
        const attributes = segment.getAttributes()
        t.equal(attributes.foo, 'bar')
        t.equal(attributes.fiz, 'bang')
        t.end()
      }
    )

    t.test(
      'should be affected by `attributes.exclude` and `attributes.enabled` is true',
      function (t) {
        t.ok(segment.attributes)
        const attributes = segment.getAttributes()
        t.equal(attributes.foo, 'bar')
        t.equal(attributes.fiz, 'bang')
        t.notOk(attributes.ignore_me)
        t.notOk(attributes.host)
        t.notOk(attributes.port_path_or_id)
        t.notOk(attributes.database_name)
        t.end()
      }
    )

    t.test(
      'should not copy parameters into segment attributes when `attributes.enabled` is fale',
      function (t) {
        agent.config.attributes.enabled = false
        helper.runInTransaction(agent, function () {
          segment = shim.createSegment({ name: 'child', parameters })
        })
        t.ok(segment.attributes)
        const attributes = segment.getAttributes()
        t.notOk(attributes.foo)
        t.notOk(attributes.fiz)
        t.notOk(attributes.ignore_me)
        t.notOk(attributes.host)
        t.notOk(attributes.port_path_or_id)
        t.notOk(attributes.database_name)
        t.end()
      }
    )
  })

  t.test('#getName', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should return the `name` property of an object if it has one', function (t) {
      t.equal(shim.getName({ name: 'foo' }), 'foo')
      t.equal(
        shim.getName(function bar() {}),
        'bar'
      )
      t.end()
    })

    t.test('should return "<anonymous>" if the object has no name', function (t) {
      t.equal(shim.getName({}), '<anonymous>')
      t.equal(
        shim.getName(function () {}),
        '<anonymous>'
      )
      t.end()
    })
  })

  t.test('#isObject', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should detect if an item is an object', function (t) {
      t.ok(shim.isObject({}))
      t.ok(shim.isObject([]))
      t.ok(shim.isObject(arguments))
      t.ok(shim.isObject(function () {}))
      t.notOk(shim.isObject(true))
      t.notOk(shim.isObject(false))
      t.notOk(shim.isObject('foobar'))
      t.notOk(shim.isObject(1234))
      t.notOk(shim.isObject(null))
      t.notOk(shim.isObject(undefined))
      t.end()
    })
  })

  t.test('#isFunction', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should detect if an item is a function', function (t) {
      t.ok(shim.isFunction(function () {}))
      t.notOk(shim.isFunction({}))
      t.notOk(shim.isFunction([]))
      t.notOk(shim.isFunction(arguments))
      t.notOk(shim.isFunction(true))
      t.notOk(shim.isFunction(false))
      t.notOk(shim.isFunction('foobar'))
      t.notOk(shim.isFunction(1234))
      t.notOk(shim.isFunction(null))
      t.notOk(shim.isFunction(undefined))
      t.end()
    })
  })

  t.test('#isString', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should detect if an item is a string', function (t) {
      t.ok(shim.isString('foobar'))
      t.ok(shim.isString(new String('foobar')))
      t.notOk(shim.isString({}))
      t.notOk(shim.isString([]))
      t.notOk(shim.isString(arguments))
      t.notOk(shim.isString(function () {}))
      t.notOk(shim.isString(true))
      t.notOk(shim.isString(false))
      t.notOk(shim.isString(1234))
      t.notOk(shim.isString(null))
      t.notOk(shim.isString(undefined))
      t.end()
    })
  })

  t.test('#isNumber', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should detect if an item is a number', function (t) {
      t.ok(shim.isNumber(1234))
      t.notOk(shim.isNumber({}))
      t.notOk(shim.isNumber([]))
      t.notOk(shim.isNumber(arguments))
      t.notOk(shim.isNumber(function () {}))
      t.notOk(shim.isNumber(true))
      t.notOk(shim.isNumber(false))
      t.notOk(shim.isNumber('foobar'))
      t.notOk(shim.isNumber(null))
      t.notOk(shim.isNumber(undefined))
      t.end()
    })
  })

  t.test('#isBoolean', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should detect if an item is a boolean', function (t) {
      t.ok(shim.isBoolean(true))
      t.ok(shim.isBoolean(false))
      t.notOk(shim.isBoolean({}))
      t.notOk(shim.isBoolean([]))
      t.notOk(shim.isBoolean(arguments))
      t.notOk(shim.isBoolean(function () {}))
      t.notOk(shim.isBoolean('foobar'))
      t.notOk(shim.isBoolean(1234))
      t.notOk(shim.isBoolean(null))
      t.notOk(shim.isBoolean(undefined))
      t.end()
    })
  })

  t.test('#isArray', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should detect if an item is an array', function (t) {
      t.ok(shim.isArray([]))
      t.notOk(shim.isArray({}))
      t.notOk(shim.isArray(arguments))
      t.notOk(shim.isArray(function () {}))
      t.notOk(shim.isArray(true))
      t.notOk(shim.isArray(false))
      t.notOk(shim.isArray('foobar'))
      t.notOk(shim.isArray(1234))
      t.notOk(shim.isArray(null))
      t.notOk(shim.isArray(undefined))
      t.end()
    })
  })

  t.test('#isNull', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should detect if an item is null', function (t) {
      t.ok(shim.isNull(null))
      t.notOk(shim.isNull({}))
      t.notOk(shim.isNull([]))
      t.notOk(shim.isNull(arguments))
      t.notOk(shim.isNull(function () {}))
      t.notOk(shim.isNull(true))
      t.notOk(shim.isNull(false))
      t.notOk(shim.isNull('foobar'))
      t.notOk(shim.isNull(1234))
      t.notOk(shim.isNull(undefined))
      t.end()
    })
  })

  t.test('#toArray', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should convert array-like objects into arrays', function (t) {
      const res = ['a', 'b', 'c', 'd']
      const resToArray = shim.toArray(res)
      t.same(resToArray, res)
      t.ok(resToArray instanceof Array)

      const strToArray = shim.toArray('abcd')
      t.same(strToArray, res)
      t.ok(strToArray instanceof Array)

      argumentsTest.apply(null, res)
      function argumentsTest() {
        const argsToArray = shim.toArray(arguments)
        t.same(argsToArray, res)
        t.ok(argsToArray instanceof Array)
      }
      t.end()
    })
  })

  t.test('#normalizeIndex', function (t) {
    t.autoend()
    let args = null

    t.beforeEach(function () {
      beforeEach()
      args = [1, 2, 3, 4]
    })
    t.afterEach(afterEach)

    t.test('should return the index if it is already normal', function (t) {
      t.equal(shim.normalizeIndex(args.length, 0), 0)
      t.equal(shim.normalizeIndex(args.length, 1), 1)
      t.equal(shim.normalizeIndex(args.length, 3), 3)
      t.end()
    })

    t.test('should offset negative indexes from the end of the array', function (t) {
      t.equal(shim.normalizeIndex(args.length, -1), 3)
      t.equal(shim.normalizeIndex(args.length, -2), 2)
      t.equal(shim.normalizeIndex(args.length, -4), 0)
      t.end()
    })

    t.test('should return `null` for invalid indexes', function (t) {
      t.equal(shim.normalizeIndex(args.length, 4), null)
      t.equal(shim.normalizeIndex(args.length, 10), null)
      t.equal(shim.normalizeIndex(args.length, -5), null)
      t.equal(shim.normalizeIndex(args.length, -10), null)
      t.end()
    })
  })

  t.test('#defineProperty', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create an enumerable, configurable property', function (t) {
      const obj = {}
      shim.defineProperty(obj, 'foo', 'bar')
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      t.ok(descriptor.configurable)
      t.ok(descriptor.enumerable)
      t.end()
    })

    t.test('should create an unwritable property when `value` is not a function', function (t) {
      const obj = {}
      shim.defineProperty(obj, 'foo', 'bar')
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      t.notOk(descriptor.writable)
      t.notOk(descriptor.get)
      t.equal(descriptor.value, 'bar')
      t.end()
    })

    t.test('should create a getter when `value` is a function', function (t) {
      const obj = {}
      shim.defineProperty(obj, 'foo', function () {
        return 'bar'
      })
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      t.ok(descriptor.configurable)
      t.ok(descriptor.enumerable)
      t.ok(descriptor.get instanceof Function)
      t.notOk(descriptor.value)
      t.end()
    })
  })

  t.test('#defineProperties', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create properties for each key on `props`', function (t) {
      const obj = {}
      const props = { foo: 'bar', fiz: 'bang' }
      shim.defineProperties(obj, props)

      t.equal(obj.foo, 'bar')
      t.equal(obj.fiz, 'bang')
      t.end()
    })
  })

  t.test('#setDefaults', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should copy over defaults when provided object is null', function (t) {
      const obj = null
      const defaults = { foo: 1, bar: 2 }
      const defaulted = shim.setDefaults(obj, defaults)

      t.not(obj, defaults)
      t.not(obj, defaulted)
      t.same(defaulted, defaults)
      t.end()
    })

    t.test('should copy each key over', function (t) {
      const obj = {}
      const defaults = { foo: 1, bar: 2 }
      const defaulted = shim.setDefaults(obj, defaults)

      t.equal(obj, defaulted)
      t.not(obj, defaults)
      t.same(defaulted, defaults)
      t.end()
    })

    t.test('should update existing if existing is null', function (t) {
      const obj = { foo: null }
      const defaults = { foo: 1, bar: 2 }
      const defaulted = shim.setDefaults(obj, defaults)

      t.equal(obj, defaulted)
      t.not(obj, defaults)
      t.same(defaulted, { foo: 1, bar: 2 })
      t.end()
    })
  })

  t.test('#proxy', function (t) {
    t.autoend()
    let original = null
    let proxied = null

    t.beforeEach(function () {
      beforeEach()
      original = { foo: 1, bar: 2, biz: 3, baz: 4 }
      proxied = {}
    })

    t.afterEach(function () {
      afterEach()
      original = null
      proxied = null
    })

    t.test('should proxy individual properties', function (t) {
      shim.proxy(original, 'foo', proxied)
      t.ok(original.foo, 1)
      t.ok(proxied.foo, 1)
      t.notOk(proxied.bar)
      t.notOk(proxied.biz)

      proxied.foo = 'other'
      t.equal(original.foo, 'other')
      t.end()
    })

    t.test('should proxy arrays of properties', function (t) {
      shim.proxy(original, ['foo', 'bar'], proxied)
      t.equal(original.foo, 1)
      t.equal(original.bar, 2)
      t.equal(proxied.foo, 1)
      t.equal(proxied.bar, 2)
      t.notOk(proxied.biz)

      proxied.foo = 'other'
      t.equal(original.foo, 'other')
      t.equal(original.bar, 2)

      proxied.bar = 'another'
      t.equal(original.foo, 'other')
      t.equal(original.bar, 'another')
      t.end()
    })
  })

  t.test('assignOriginal', (t) => {
    const mod = 'originalShimTests'
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should assign shim id to wrapped item as symbol', (t) => {
      const shim = new Shim(agent, mod, mod)
      const wrapped = function wrapped() {}
      const original = function original() {}
      shim.assignOriginal(wrapped, original)
      t.equal(wrapped[symbols.wrapped], shim.id)
      t.end()
    })

    t.test('should assign original on wrapped item as symbol', (t) => {
      const shim = new Shim(agent, mod, mod)
      const wrapped = function wrapped() {}
      const original = function original() {}
      shim.assignOriginal(wrapped, original)
      t.equal(wrapped[symbols.original], original)
      t.end()
    })

    t.test('should should overwrite original when forceOrig is true', (t) => {
      const shim = new Shim(agent, mod, mod)
      const wrapped = function wrapped() {}
      const original = function original() {}
      const firstOriginal = function firstOriginal() {}
      wrapped[symbols.original] = firstOriginal
      shim.assignOriginal(wrapped, original, true)
      t.equal(wrapped[symbols.original], original)
      t.end()
    })

    t.test('should not assign original if symbol already exists on wrapped item', (t) => {
      const shim = new Shim(agent, mod, mod)
      const wrapped = function wrapped() {}
      const original = function original() {}
      const firstOriginal = function firstOriginal() {}
      wrapped[symbols.original] = firstOriginal
      shim.assignOriginal(wrapped, original)
      t.not(wrapped[symbols.original], original)
      t.equal(wrapped[symbols.original], firstOriginal)
      t.end()
    })
  })

  t.test('assignId', (t) => {
    const mod1 = 'mod1'
    const mod2 = 'mod2'
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should assign an id to a shim instance', (t) => {
      const shim = new Shim(agent, mod1, mod1)
      t.ok(shim.id)
      t.end()
    })

    t.test('should associate same id to a different shim instance when shimName matches', (t) => {
      const shim = new Shim(agent, mod1, mod1, mod1)
      const shim2 = new Shim(agent, mod2, mod2, mod1)
      t.equal(shim.id, shim2.id, 'ids should be the same')
      t.end()
    })

    t.test('should not associate id when shimName does not match', (t) => {
      const shim = new Shim(agent, mod1, mod1, mod1)
      const shim2 = new Shim(agent, mod2, mod2, mod2)
      t.not(shim.id, shim2.id, 'ids should not be the same')
      t.end()
    })
  })

  t.test('prefixRouteParameters', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not prefix parameters when given invalid input', (t) => {
      const resultNull = shim.prefixRouteParameters(null)
      t.equal(resultNull, undefined)

      const resultString = shim.prefixRouteParameters('parameters')
      t.equal(resultString, undefined)
      t.end()
    })

    t.test('should return the object with route param prefix applied to keys', (t) => {
      const result = shim.prefixRouteParameters({ id: '123abc', foo: 'bar' })
      t.same(result, {
        'request.parameters.route.id': '123abc',
        'request.parameters.route.foo': 'bar'
      })
      t.end()
    })
  })

  t.test('getOriginalOnce', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should return the function on original symbol', (t) => {
      const orig = wrappable.bar
      shim.wrap(wrappable, 'bar', function wrapBar(_shim, fn) {
        return function wrappedBar() {
          const ret = fn.apply(this, arguments)
          return `${ret} wrapped`
        }
      })

      t.same(orig, shim.getOriginalOnce(wrappable.bar), 'should get original')
      t.end()
    })

    t.test(
      'should return the function on original symbol for a given property of a module',
      (t) => {
        const orig = wrappable.bar
        shim.wrap(wrappable, 'bar', function wrapBar(_shim, fn) {
          return function wrappedBar() {
            const ret = fn.apply(this, arguments)
            return `${ret} wrapped`
          }
        })

        t.same(orig, shim.getOriginalOnce(wrappable, 'bar'), 'should get original')
        t.end()
      }
    )

    t.test('should not return original if wrapped twice', (t) => {
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
      t.not(orig, notOrig, 'should not be original but first wrapped')
      t.equal(notOrig.name, 'wrappedBar', 'should be the first wrapped function name')
      t.end()
    })

    t.test('should not return if module is undefined', (t) => {
      const nodule = undefined
      t.equal(shim.getOriginalOnce(nodule), undefined)
      t.end()
    })
  })

  t.test('getOriginal', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should return the function on original symbol', (t) => {
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

      t.same(orig, shim.getOriginal(wrappable.bar), 'should get original')
      t.end()
    })

    t.test(
      'should return the function on original symbol for a given property of a module',
      (t) => {
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

        t.same(orig, shim.getOriginal(wrappable, 'bar'), 'should get original')
        t.end()
      }
    )

    t.test('should not return if module is undefined', (t) => {
      const nodule = undefined
      t.equal(shim.getOriginal(nodule), undefined)
      t.end()
    })
  })

  t.test('_moduleRoot', (t) => {
    t.beforeEach((t) => {
      t.context.agent = helper.loadMockedAgent()
    })

    t.afterEach((t) => {
      helper.unloadAgent(t.context.agent)
    })

    t.test('should set _moduleRoot to `.` if resolvedName is a built-in', (t) => {
      const { agent } = t.context
      const shim = new Shim(agent, 'http', 'http')
      t.equal(shim._moduleRoot, '.')
      t.end()
    })

    t.test(
      'should set _moduleRoot to `.` if resolvedName is undefined but moduleName  is a built-in',
      (t) => {
        const { agent } = t.context
        const shim = new Shim(agent, 'http')
        t.equal(shim._moduleRoot, '.')
        t.end()
      }
    )

    t.test('should set _moduleRoot to resolvedName not a built-in', (t) => {
      const { agent } = t.context
      const root = '/path/to/app/node_modules/rando-mod'
      const shim = new Shim(agent, 'rando-mod', root)
      t.equal(shim._moduleRoot, root)
      t.end()
    })

    t.test('should properly resolve _moduleRoot as windows path', (t) => {
      const { agent } = t.context
      const root = `c:\\path\\to\\app\\node_modules\\@scope\\test`
      const shim = new Shim(agent, '@scope/test', root)
      t.equal(shim._moduleRoot, root)
      t.end()
    })
    t.end()
  })

  t.test('shim.specs', (t) => {
    const agent = helper.loadMockedAgent()
    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    const shim = new Shim(agent, 'test-mod')
    t.ok(shim.specs, 'should assign specs to an instance of shim')
    t.ok(shim.specs.ClassWrapSpec)
    t.ok(shim.specs.MessageSpec)
    t.ok(shim.specs.MessageSubscribeSpec)
    t.ok(shim.specs.MiddlewareMounterSpec)
    t.ok(shim.specs.MiddlewareSpec)
    t.ok(shim.specs.OperationSpec)
    t.ok(shim.specs.QuerySpec)
    t.ok(shim.specs.RecorderSpec)
    t.ok(shim.specs.RenderSpec)
    t.ok(shim.specs.SegmentSpec)
    t.ok(shim.specs.TransactionSpec)
    t.ok(shim.specs.WrapSpec)
    t.ok(shim.specs.params.DatastoreParameters)
    t.ok(shim.specs.params.QueueMessageParameters)
    t.end()
  })

  t.test('should not use functions in MessageSubscribeSpec if it is not an array', (t) => {
    const agent = helper.loadMockedAgent()
    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    const shim = new Shim(agent, 'test-mod')
    const spec = new shim.specs.MessageSubscribeSpec({
      functions: 'foo-bar'
    })
    t.notOk(spec.functions)
    t.end()
  })
})
