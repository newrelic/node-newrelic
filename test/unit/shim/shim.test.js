/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai = require('chai')
var EventEmitter = require('events').EventEmitter
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var Promise = global.Promise || require('bluebird')
var sinon = require('sinon')
var Shim = require('../../../lib/shim/shim')


describe('Shim', function() {
  var agent = null
  var shim = null
  var wrappable = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    shim = new Shim(agent, 'test-module')
    wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() { return 'fiz' },
      anony: function() {},
      getActiveSegment: function() {
        return agent.tracer.getSegment()
      }
    }
  })

  afterEach(function() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  describe('constructor', function() {
    it('should require an agent parameter', function() {
      expect(function() { return new Shim() })
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })

    it('should require a module name parameter', function() {
      expect(function() { return new Shim(agent) })
        .to.throw(Error, /^Shim must be initialized with .*? module name/)
    })
  })

  describe('.defineProperty', function() {
    describe('with a value', function() {
      it('should create a non-writable property', function() {
        var foo = {}
        Shim.defineProperty(foo, 'bar', 'foobar')
        expect(foo).to.have.property('bar', 'foobar')
        testNonWritable(foo, 'bar', 'foobar')
      })
    })

    describe('with a function', function() {
      it('should create a getter', function() {
        var foo = {}
        var getterCalled = false
        Shim.defineProperty(foo, 'bar', function() {
          getterCalled = true
          return 'foobar'
        })

        expect(getterCalled).to.be.false
        expect(foo.bar).to.equal('foobar')
        expect(getterCalled).to.be.true
      })
    })
  })

  describe('.defineProperties', function() {
    it('should create all the properties specified', function() {
      var foo = {}
      Shim.defineProperties(foo, {
        bar: 'foobar',
        fiz: function() { return 'bang' }
      })

      expect(foo).to.have.keys(['bar', 'fiz'])
    })
  })

  describe('#FIRST through #LAST', function() {
    var keys = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST']

    it('should be a non-writable property', function() {
      keys.forEach(function(k) {
        testNonWritable(shim, k)
      })
    })

    it('should be an array index value', function() {
      keys.forEach(function(k, i) {
        expect(shim).to.have.property(k, k === 'LAST' ? -1 : i)
      })
    })
  })

  describe('#agent', function() {
    it('should be a non-writable property', function() {
      testNonWritable(shim, 'agent', agent)
    })

    it('should be the agent handed to the constructor', function() {
      var foo = {}
      var s = new Shim(foo, 'test-module')
      expect(s.agent).to.equal(foo)
    })
  })

  describe('#tracer', function() {
    it('should be a non-writable property', function() {
      testNonWritable(shim, 'tracer', agent.tracer)
    })

    it('should be the tracer from the agent', function() {
      var foo = {tracer: {}}
      var s = new Shim(foo, 'test-module')
      expect(s.tracer).to.equal(foo.tracer)
    })
  })

  describe('#moduleName', function() {
    it('should be a non-writable property', function() {
      testNonWritable(shim, 'moduleName', 'test-module')
    })

    it('should be the name handed to the constructor', function() {
      var s = new Shim(agent, 'some-module-name')
      expect(s.moduleName).to.equal('some-module-name')
    })
  })

  describe('#logger', function() {
    it('should be a non-writable property', function() {
      testNonWritable(shim, 'logger')
    })

    it('should be a logger to use with the shim', function() {
      expect(shim.logger).to.have.property('trace')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('debug')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('info')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('warn')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('error')
        .that.is.an.instanceof(Function)
    })
  })

  describe('#wrap', function() {
    it('should call the spec with the to-be-wrapped item', function() {
      shim.wrap(wrappable, function(_shim, toWrap, name) {
        expect(_shim).to.equal(shim)
        expect(toWrap).to.equal(wrappable)
        expect(name).to.equal(wrappable.name)
      })
    })

    it('should match the arity and name of the original when specified', function() {
      function toWrap(a, b) {} // eslint-disable-line no-unused-vars
      var wrapped = shim.wrap(toWrap, {
        wrapper: function() {
          return function wrappedFn() {
          }
        },
        matchArity: true
      })
      expect(wrapped).to.not.equal(toWrap)
      expect(wrapped.length).to.equal(toWrap.length)
      expect(wrapped.name).to.equal(toWrap.name)
    })

    it('should pass items in the `args` parameter to the spec', function() {
      /* eslint-disable max-params */
      shim.wrap(wrappable, function(_shim, toWrap, name, arg1, arg2, arg3) {
        expect(arguments.length).to.equal(6)
        expect(arg1).to.equal('a')
        expect(arg2).to.equal('b')
        expect(arg3).to.equal('c')
      }, ['a', 'b', 'c'])
      /* eslint-enable max-params */
    })

    describe('with no properties', function() {
      it('should wrap the first parameter', function() {
        shim.wrap(wrappable, function(_, toWrap) {
          expect(toWrap).to.equal(wrappable)
        })
      })

      it('should wrap the first parameter when properties is `null`', function() {
        shim.wrap(wrappable, null, function(_, toWrap) {
          expect(toWrap).to.equal(wrappable)
        })
      })

      it('should mark the first parameter as wrapped', function() {
        var wrapped = shim.wrap(wrappable, function(_, toWrap) {
          return {wrappable: toWrap}
        })

        expect(wrapped).to.not.equal(wrappable)
        expect(wrapped).to.have.property('wrappable', wrappable)
        expect(shim.isWrapped(wrapped)).to.be.true
      })
    })

    describe('with properties', function() {
      var barTestWrapper = null
      var originalBar = null
      var ret = null

      beforeEach(function() {
        barTestWrapper = function() {}
        originalBar = wrappable.bar
        ret = shim.wrap(wrappable, 'bar', function() {
          return barTestWrapper
        })
      })

      it('should accept a single property', function() {
        var originalFiz = wrappable.fiz
        shim.wrap(wrappable, 'fiz', function(_, toWrap, name) {
          expect(toWrap).to.equal(wrappable.fiz)
          expect(name).to.equal('fiz', 'should use property as name')
        })

        expect(ret).to.equal(wrappable)
        expect(wrappable.fiz).to.equal(originalFiz, 'should not replace unwrapped')
      })

      it('should accept an array of properties', function() {
        var specCalled = 0
        shim.wrap(wrappable, ['fiz', 'anony'], function(_, toWrap, name) {
          ++specCalled
          if (specCalled === 1) {
            expect(toWrap).to.equal(wrappable.fiz)
            expect(name).to.equal('fiz')
          } else if (specCalled === 2) {
            expect(toWrap).to.equal(wrappable.anony)
            expect(name).to.equal('anony')
          }
        })

        expect(specCalled).to.equal(2)
      })

      it('should replace wrapped properties on the original object', function() {
        expect(wrappable.bar).to.not.equal(originalBar)
      })

      it('should mark wrapped properties as such', function() {
        expect(shim.isWrapped(wrappable, 'bar')).to.be.true
      })

      it('should not mark unwrapped properties as wrapped', function() {
        expect(shim.isWrapped(wrappable, 'fiz')).to.be.false
      })
    })

    describe('with a function', function() {
      var wrapper = null
      beforeEach(function() {
        wrapper = function wrapperFunc() {return function wrapped() {}}
        shim.wrap(wrappable, 'bar', wrapper)
      })

      it('should not maintain the name', function() {
        expect(wrappable.bar).to.have.property('name', 'wrapped')
      })

      it('should not maintain the arity', function() {
        expect(wrappable.bar).to.have.length(0)
      })
    })
  })

  describe('#bindSegment', function() {
    var segment

    beforeEach(function() {
      segment = {
        started: false,
        touched: false,
        probed: false,
        start: function() { this.started = true },
        touch: function() { this.touched = true },
        probe: function() { this.probed = true }
      }
    })

    it('should not wrap non-functions', function() {
      shim.bindSegment(wrappable, 'name')
      expect(shim.isWrapped(wrappable, 'name')).to.be.false
    })

    it('should not error if `nodule` is `null`', function() {
      expect(function() {
        shim.bindSegment(null, 'foobar', segment)
      }).to.not.throw()
    })

    describe('with no property', function() {
      it('should wrap the first parameter if `property` is not given', function() {
        var wrapped = shim.bindSegment(wrappable.getActiveSegment, segment)

        expect(wrapped).to.not.equal(wrappable.getActiveSegment)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.getActiveSegment)
      })

      it('should wrap the first parameter if `property` is `null`', function() {
        var wrapped = shim.bindSegment(wrappable.getActiveSegment, null, segment)

        expect(wrapped).to.not.equal(wrappable.getActiveSegment)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.getActiveSegment)
      })
    })

    describe('with no segment', function() {
      it('should not wrap the function at all', function() {
        var wrapped = shim.bindSegment(wrappable.getActiveSegment)
        expect(wrapped).to.equal(wrappable.getActiveSegment)
        expect(shim.isWrapped(wrapped)).to.be.false
      })

      it('should be safe to pass a full param', function() {
        var wrapped = shim.bindSegment(wrappable.getActiveSegment, null, true)
        expect(wrapped).to.equal(wrappable.getActiveSegment)
        expect(shim.isWrapped(wrapped)).to.be.false
        expect(wrapped).to.not.throw()
      })
    })

    describe('wrapper', function() {
      var startingSegment

      beforeEach(function() {
        startingSegment = agent.tracer.getSegment()
      })

      it('should make the given segment active while executing', function() {
        expect(startingSegment)
          .to.not.equal(segment, 'test should start in clean condition')

        shim.bindSegment(wrappable, 'getActiveSegment', segment)
        expect(agent.tracer.segment).to.equal(startingSegment)
        expect(wrappable.getActiveSegment()).to.equal(segment)
        expect(agent.tracer.segment).to.equal(startingSegment)
      })

      it('should not require any arguments except a function', function() {
        expect(startingSegment)
          .to.not.equal(segment, 'test should start in clean condition')

        // bindSegment will not wrap if there is no segment active and
        // no segment is passed in.  To get around this we set the
        // active segment to an object known not to be null then do the
        // wrapping.
        agent.tracer.segment = segment
        var wrapped = shim.bindSegment(wrappable.getActiveSegment)
        agent.tracer.segment = startingSegment

        expect(wrapped()).to.equal(segment)
        expect(agent.tracer.segment).to.equal(startingSegment)
      })

      it('should default `full` to false', function() {
        shim.bindSegment(wrappable, 'getActiveSegment', segment)
        wrappable.getActiveSegment()

        expect(segment.started).to.be.false
        expect(segment.touched).to.be.false
      })

      it('should start and touch the segment if `full` is `true`', function() {
        shim.bindSegment(wrappable, 'getActiveSegment', segment, true)
        wrappable.getActiveSegment()

        expect(segment.started).to.be.true
        expect(segment.touched).to.be.true
      })

      it('should default to the current segment', function() {
        agent.tracer.segment = segment
        shim.bindSegment(wrappable, 'getActiveSegment')
        var activeSegment = wrappable.getActiveSegment()
        expect(activeSegment).to.equal(segment)
      })
    })
  })

  describe('#execute', function() {
  })

  describe('#wrapReturn', function() {
    it('should not wrap non-function objects', function() {
      shim.wrapReturn(wrappable, 'name', function() {})
      expect(shim.isWrapped(wrappable, 'name')).to.be.false
    })

    it('should not blow up when wrapping a non-object prototype', function() {
      function noProto() {}
      noProto.prototype = undefined
      var instance = shim.wrapReturn(noProto, function() {}).bind({})
      expect(instance).to.not.throw()
    })

    it('should not blow up when wrapping a non-object prototype', function() {
      function noProto() {}
      noProto.prototype = undefined
      var instance = shim.wrapReturn(noProto, function() {}).bind(null)
      expect(instance).to.not.throw()
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.wrapReturn(wrappable.bar, function() {})

        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.wrapReturn(wrappable.bar, null, function() {})

        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.wrapReturn(wrappable, 'bar', function() {})

        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable, 'bar')).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })
    })

    describe('wrapper', function() {
      var executed
      var toWrap
      var returned

      beforeEach(function() {
        executed = false
        toWrap = {
          foo: function() {
            executed = true
            returned = {
              context: this,
              args: shim.toArray(arguments)
            }
            return returned
          }
        }
      })

      it('should execute the wrapped function', function() {
        shim.wrapReturn(toWrap, 'foo', function() {})
        var res = toWrap.foo('a', 'b', 'c')
        expect(executed).to.be.true
        expect(res.context).to.equal(toWrap)
        expect(res.args).to.eql(['a', 'b', 'c'])
      })

      it('should pass properties through', function() {
        const original = toWrap.foo
        original.testSymbol = Symbol('test')
        shim.wrapReturn(toWrap, 'foo', function() {})

        // wrapper is not the same function reference
        expect(original).to.not.equal(toWrap.foo)
        // set on original
        expect(toWrap.foo.testSymbol).to.equal(original.testSymbol)
      })

      it('should pass assignments to the wrapped method', function() {
        const original = toWrap.foo
        shim.wrapReturn(toWrap, 'foo', function() {})
        toWrap.foo.testProp = 1

        // wrapper is not the same function reference
        expect(original).to.not.equal(toWrap.foo)
        // set via wrapper
        expect(original.testProp).to.equal(1)
      })

      it('should pass defined properties to the wrapped method', function() {
        const original = toWrap.foo
        shim.wrapReturn(toWrap, 'foo', function() {})
        Object.defineProperty(toWrap.foo, 'testDefProp', {value: 4})

        // wrapper is not the same function reference
        expect(original).to.not.equal(toWrap.foo)
        // set with defineProperty via wrapper
        expect(original.testDefProp).to.equal(4)
      })


      it('should have the same key enumeration', function() {
        const original = toWrap.foo
        original.testSymbol = Symbol('test')
        shim.wrapReturn(toWrap, 'foo', function() {})
        toWrap.foo.testProp = 1

        // wrapper is not the same function reference
        expect(original).to.not.equal(toWrap.foo)
        // should have the same keys
        expect(Object.keys(original)).to.deep.equal(Object.keys(toWrap.foo))
      })

      it('should call the spec with returned value', function() {
        var specExecuted = false
        shim.wrapReturn(toWrap, 'foo', function(_, fn, name, ret) {
          specExecuted = true
          expect(ret).to.equal(returned)
        })

        toWrap.foo()
        expect(specExecuted).to.be.true
      })

      it('should invoke the spec in the context of the wrapped function', function() {
        shim.wrapReturn(toWrap, 'foo', function() {
          expect(this).to.equal(toWrap)
        })

        toWrap.foo()
      })

      it('should invoke the spec with `new` if itself is invoked with `new`', function() {
        function Foo() {
          expect(this).to.be.an.instanceOf(Foo)
        }
        var WrappedFoo = shim.wrapReturn(Foo, function() {
          expect(this).to.be.an.instanceOf(Foo)
        })

        var foo = new WrappedFoo()
        expect(foo).to.be.an.instanceOf(Foo)
        expect(foo).to.be.an.instanceOf(WrappedFoo)
      })

      it('should pass items in the `args` parameter to the spec', function() {
        /* eslint-disable max-params */
        shim.wrapReturn(toWrap, 'foo', function(_, fn, name, ret, a, b, c) {
          expect(arguments.length).to.equal(7)
          expect(a).to.equal('a')
          expect(b).to.equal('b')
          expect(c).to.equal('c')
        }, ['a', 'b', 'c'])
        /* eslint-enable max-params */

        toWrap.foo()
      })
    })
  })

  describe('#wrapClass', function() {
    it('should not wrap non-function objects', function() {
      shim.wrapClass(wrappable, 'name', function() {})
      expect(shim.isWrapped(wrappable, 'name')).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.wrapClass(wrappable.bar, function() {})

        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.wrapClass(wrappable.bar, null, function() {})

        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.wrapClass(wrappable, 'bar', function() {})

        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable, 'bar')).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })
    })

    describe('wrapper', function() {
      var executed = null
      var toWrap = null
      var original = null

      beforeEach(function() {
        executed = false
        toWrap = {
          Foo: function() {
            this.executed = executed = true
            this.context = this
            this.args = shim.toArray(arguments)
          }
        }
        original = toWrap.Foo
      })

      it('should execute the wrapped function', function() {
        shim.wrapClass(toWrap, 'Foo', function() {})
        var res = new toWrap.Foo('a', 'b', 'c')
        expect(executed).to.be.true
        expect(res.context).to.equal(res)
        expect(res.args).to.eql(['a', 'b', 'c'])
      })

      it('should call the hooks in the correct order', function() {
        var preExecuted = false
        var postExecuted = false
        shim.wrapClass(toWrap, 'Foo', {
          pre: function() {
            preExecuted = true
            expect(this).to.be.null
          },
          post: function() {
            postExecuted = true
            expect(this).to.have.property('executed', true)
            expect(this).to.be.an.instanceOf(toWrap.Foo)
            expect(this).to.be.an.instanceOf(original)
          }
        })

        var foo = new toWrap.Foo()
        expect(preExecuted).to.be.true
        expect(foo.executed).to.be.true
        expect(postExecuted).to.be.true
      })

      it('should pass items in the `args` parameter to the spec', function() {
        /* eslint-disable max-params */
        shim.wrapClass(toWrap, 'Foo', function(_, fn, name, args, a, b, c) {
          expect(arguments.length).to.equal(7)
          expect(a).to.equal('a')
          expect(b).to.equal('b')
          expect(c).to.equal('c')
        }, ['a', 'b', 'c'])
        /* eslint-enable max-params */

        /* eslint-disable no-unused-vars */
        var foo = new toWrap.Foo()
        /* eslint-enable no-unused-vars */
      })
    })
  })

  describe('#wrapExport', function() {
    it('should execute the given wrap function', function() {
      var executed = false
      shim.wrapExport({}, function() {
        executed = true
      })
      expect(executed).to.be.true
    })

    it('should store the wrapped version for later retrival', function() {
      var original = {}
      var wrapped = shim.wrapExport(original, function() {
        return {}
      })

      expect(shim.getExport()).to.equal(wrapped).and.not.equal(original)
    })
  })

  describe('#record', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.record(wrappable, function() {})
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.record(wrappable.bar, function() {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.record(wrappable.bar, null, function() {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.record(wrappable, 'bar', function() {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.record(wrappable, 'name', function() {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('with internal segments', function() {
      it('should not create a child segment', function() {
        shim.record(wrappable, 'getActiveSegment', function() {
          return {name: 'internal test segment', internal: true}
        })

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          startingSegment.internal = true
          startingSegment.shim = shim
          var segment = wrappable.getActiveSegment()
          expect(segment).to.equal(startingSegment)
          expect(segment.transaction).to.equal(tx)
          expect(segment.name).to.equal('ROOT')
          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should still bind the callback', function() {
        var wrapped = shim.record(function(cb) {
          expect(shim.isWrapped(cb)).to.be.true
        }, function() {
          return {name: 'test segment', internal: true, callback: shim.LAST}
        })

        helper.runInTransaction(agent, function() {
          var startingSegment = agent.tracer.getSegment()
          startingSegment.internal = true
          startingSegment.shim = shim
          wrapped(function() {})
        })
      })

      it('should not throw when using an ended segment as parent', function() {
        helper.runInTransaction(agent, function(tx) {
          tx.end()
          var wrapped = shim.record(function(cb) {
            expect(shim.isWrapped(cb)).to.not.be.true
            expect(agent.getTransaction()).to.equal(null)
          }, function() {
            return {
              name: 'test segment',
              internal: true,
              callback: shim.LAST,
              parent: tx.trace.root
            }
          })
          expect(function() {
            wrapped(function() {})
          }).to.not.throw()
        })
      })
    })

    describe('with a stream', function() {
      var stream = null
      var toWrap = null

      beforeEach(function() {
        stream = new EventEmitter()
        toWrap = function() {
          stream.segment = agent.tracer.getSegment()
          return stream
        }
      })

      afterEach(function() {
        stream = null
        toWrap = null
      })

      it('should make the segment translucent when `end` is emitted', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', stream: true, opaque: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.equal(stream)
        })

        expect(stream.segment.opaque).to.be.true
        setTimeout(function() {
          stream.emit('end')
          expect(stream.segment.opaque).to.be.false
          done()
        }, 5)
      })

      it('should touch the segment when `end` is emitted', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', stream: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.equal(stream)
        })

        var oldDur = stream.segment.timer.getDurationInMillis()
        setTimeout(function() {
          stream.emit('end')
          expect(stream.segment.timer.getDurationInMillis()).to.be.above(oldDur)
          done()
        }, 5)
      })

      it('should make the segment translucent when `error` is emitted', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', stream: true, opaque: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.equal(stream)
        })

        stream.on('error', function() {}) // to prevent the error being thrown
        expect(stream.segment.opaque).to.be.true
        setTimeout(function() {
          stream.emit('error', 'foobar')
          expect(stream.segment.opaque).to.be.false
          done()
        }, 5)
      })

      it('should touch the segment when `error` is emitted', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', stream: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.equal(stream)
        })

        stream.on('error', function() {}) // to prevent the error being thrown
        var oldDur = stream.segment.timer.getDurationInMillis()
        setTimeout(function() {
          stream.emit('error', 'foobar')
          expect(stream.segment.timer.getDurationInMillis()).to.be.above(oldDur)
          done()
        }, 5)
      })

      it('should throw if there are no other `error` handlers', function() {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', stream: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.equal(stream)
        })

        expect(function() {
          stream.emit('error', new Error('foobar'))
        }).to.throw('foobar')
      })


      it('should bind emit to a child segment', function() {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', stream: 'foobar'}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.equal(stream)
        })

        stream.on('foobar', function() {
          var emitSegment = shim.getSegment()
          expect(emitSegment.parent).to.equal(stream.segment)
        })
        stream.emit('foobar')
      })

      it('should create an event segment if an event name is given', function() {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', stream: 'foobar'}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.equal(stream)
        })

        // Emit the event and check the segment name.
        expect(stream.segment.children).to.have.length(0)
        stream.emit('foobar')
        expect(stream.segment.children).to.have.length(1)
        var eventSegment = stream.segment.children[0]
        expect(eventSegment).to.have.property('name')
          .match(/Event callback: foobar/)

        expect(eventSegment.getAttributes()).to.have.property('count', 1)

        // Emit it again and see if the name updated.
        stream.emit('foobar')
        expect(stream.segment.children).to.have.length(1)
        expect(stream.segment.children[0]).to.equal(eventSegment)
        expect(eventSegment.getAttributes()).to.have.property('count', 2)

        // Emit it once more and see if the name updated again.
        stream.emit('foobar')
        expect(stream.segment.children).to.have.length(1)
        expect(stream.segment.children[0]).to.equal(eventSegment)
        expect(eventSegment.getAttributes()).to.have.property('count', 3)
      })
    })

    describe('with a promise', function() {
      var promise = null
      var toWrap = null

      beforeEach(function() {
        var defer = {}
        promise = new Promise(function(resolve, reject) {
          defer.resolve = resolve
          defer.reject = reject
        })
        promise.resolve = defer.resolve
        promise.reject = defer.reject

        toWrap = function() {
          promise.segment = agent.tracer.getSegment()
          return promise
        }
      })

      afterEach(function() {
        promise = null
        toWrap = null
      })

      it('should make the segment translucent when promise resolves', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', promise: true, opaque: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.be.instanceOf(Object.getPrototypeOf(promise).constructor)

          ret.then(function(val) {
            expect(result).to.equal(val)
            expect(promise.segment.opaque).to.be.false
            done()
          }).catch(done)
        })

        expect(promise.segment.opaque).to.be.true
        var result = {}
        setTimeout(function() {
          promise.resolve(result)
        }, 5)
      })

      it('should touch the segment when promise resolves', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', promise: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.be.instanceOf(Object.getPrototypeOf(promise).constructor)

          ret.then(function(val) {
            expect(result).to.equal(val)
            expect(promise.segment.timer.getDurationInMillis()).to.be.above(oldDur)
            done()
          }).catch(done)
        })

        var oldDur = promise.segment.timer.getDurationInMillis()
        var result = {}
        setTimeout(function() {
          promise.resolve(result)
        }, 5)
      })

      it('should make the segment translucent when promise rejects', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', promise: true, opaque: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.be.instanceOf(Object.getPrototypeOf(promise).constructor)

          ret.then(function() {
            done(new Error('Should not have resolved!'))
          }, function(err) {
            expect(err).to.equal(result)
            expect(promise.segment.opaque).to.be.false
            done()
          }).catch(done)
        })

        expect(promise.segment.opaque).to.be.true
        var result = {}
        setTimeout(function() {
          promise.reject(result)
        }, 5)
      })

      it('should touch the segment when promise rejects', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', promise: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.be.instanceOf(Object.getPrototypeOf(promise).constructor)

          ret.then(function() {
            done(new Error('Should not have resolved!'))
          }, function(err) {
            expect(err).to.equal(result)
            expect(promise.segment.timer.getDurationInMillis()).to.be.above(oldDur)
            done()
          }).catch(done)
        })

        var oldDur = promise.segment.timer.getDurationInMillis()
        var result = {}
        setTimeout(function() {
          promise.reject(result)
        }, 5)
      })

      it('should not affect unhandledRejection event', function(done) {
        var wrapped = shim.record(toWrap, function() {
          return {name: 'test segment', promise: true}
        })

        helper.runInTransaction(agent, function() {
          var ret = wrapped()
          expect(ret).to.be.instanceOf(Object.getPrototypeOf(promise).constructor)

          process.on('unhandledRejection', function(err, p) {
            expect(err).to.equal(result)
            expect(p).to.equal(ret)
            done()
          })
        })

        var result = {}
        setTimeout(function() {
          promise.reject(result)
        }, 5)
      })
    })

    describe('wrapper', function() {
      describe('when called without a transaction', function() {
        it('should not create a segment', function() {
          shim.record(wrappable, 'getActiveSegment', function() {
            return {name: 'test segment'}
          })

          var segment = wrappable.getActiveSegment()
          expect(segment).to.be.null
        })

        it('should execute the wrapped function', function() {
          var executed = false
          var toWrap = function() { executed = true }
          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment'}
          })

          expect(executed).to.be.false
          wrapped()
          expect(executed).to.be.true
        })

        it('should still invoke the spec', function() {
          var executed = false
          shim.record(wrappable, 'bar', function() {
            executed = true
          })

          wrappable.bar('a', 'b', 'c')
          expect(executed).to.be.true
        })

        it('should not bind the callback if there is one', function() {
          var cb = function() {}
          var toWrap = function(wrappedCB) {
            expect(wrappedCB).to.equal(cb)
            expect(shim.isWrapped(wrappedCB)).to.be.false
          }

          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment', callback: shim.LAST}
          })
          wrapped(cb)
        })

        it('should not bind the rowCallback if there is one', function() {
          var cb = function() {}
          var toWrap = function(wrappedCB) {
            expect(wrappedCB).to.equal(cb)
            expect(shim.isWrapped(wrappedCB)).to.be.false
          }

          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment', rowCallback: shim.LAST}
          })
          wrapped(cb)
        })
      })

      describe('when called in an active transaction', function() {
        it('should create a segment', function() {
          shim.record(wrappable, 'getActiveSegment', function() {
            return {name: 'test segment'}
          })

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            var segment = wrappable.getActiveSegment()
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name).to.equal('test segment')
            expect(agent.tracer.getSegment()).to.equal(startingSegment)
          })
        })

        it('should execute the wrapped function', function() {
          var executed = false
          var toWrap = function() { executed = true }
          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment'}
          })

          helper.runInTransaction(agent, function() {
            expect(executed).to.be.false
            wrapped()
            expect(executed).to.be.true
          })
        })

        it('should invoke the spec in the context of the wrapped function', function() {
          var original = wrappable.bar
          var executed = false
          shim.record(wrappable, 'bar', function(_, fn, name, args) {
            executed = true
            expect(fn).to.equal(original)
            expect(name).to.equal('bar')
            expect(this).to.equal(wrappable)
            expect(args).to.deep.equal(['a', 'b', 'c'])
          })

          helper.runInTransaction(agent, function() {
            wrappable.bar('a', 'b', 'c')
            expect(executed).to.be.true
          })
        })

        it('should bind the callback if there is one', function() {
          var cb = function() {}
          var toWrap = function(wrappedCB) {
            expect(wrappedCB).to.not.equal(cb)
            expect(shim.isWrapped(wrappedCB)).to.be.true
            expect(shim.unwrap(wrappedCB)).to.equal(cb)

            expect(function() {
              wrappedCB()
            }).to.not.throw()
          }

          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment', callback: shim.LAST}
          })

          helper.runInTransaction(agent, function() {
            wrapped(cb)
          })
        })

        it('should bind the rowCallback if there is one', function() {
          var cb = function() {}
          var toWrap = function(wrappedCB) {
            expect(wrappedCB).to.not.equal(cb)
            expect(shim.isWrapped(wrappedCB)).to.be.true
            expect(shim.unwrap(wrappedCB)).to.equal(cb)

            expect(function() {
              wrappedCB()
            }).to.not.throw()
          }

          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment', rowCallback: shim.LAST}
          })

          helper.runInTransaction(agent, function() {
            wrapped(cb)
          })
        })

        describe('when callback required', function() {
          it('should create segment if method has callback', function() {
            var cb = function() {}
            var toWrap = function(wrappedCB) {
              expect(wrappedCB).to.not.equal(cb)
              expect(shim.isWrapped(wrappedCB)).to.be.true
              expect(shim.unwrap(wrappedCB)).to.equal(cb)

              expect(function() {
                wrappedCB()
              }).to.not.throw()

              return shim.getSegment()
            }

            var wrapped = shim.record(toWrap, function() {
              return {name: 'test segment', callback: shim.LAST, callbackRequired: true}
            })

            helper.runInTransaction(agent, function() {
              var parentSegment = shim.getSegment()
              var resultingSegment = wrapped(cb)

              expect(resultingSegment === parentSegment).to.be.false
              expect(parentSegment.children).to.include(resultingSegment)
            })
          })

          it('should not create segment if method missing callback', function() {
            var toWrap = function(wrappedCB) {
              expect(wrappedCB).to.not.exist

              return shim.getSegment()
            }

            var wrapped = shim.record(toWrap, function() {
              return {name: 'test segment', callback: shim.LAST, callbackRequired: true}
            })

            helper.runInTransaction(agent, function() {
              var parentSegment = shim.getSegment()
              var resultingSegment = wrapped()

              expect(resultingSegment === parentSegment).to.be.true
              expect(parentSegment.children).to.not.include(resultingSegment)
            })
          })
        })
      })

      describe('when called with an inactive transaction', function() {
        it('should not create a segment', function() {
          shim.record(wrappable, 'getActiveSegment', function() {
            return {name: 'test segment'}
          })

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            tx.end()
            var segment = wrappable.getActiveSegment()
            expect(segment).to.equal(startingSegment)
          })
        })

        it('should execute the wrapped function', function() {
          var executed = false
          var toWrap = function() { executed = true }
          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment'}
          })

          helper.runInTransaction(agent, function(tx) {
            tx.end()
            expect(executed).to.be.false
            wrapped()
            expect(executed).to.be.true
          })
        })

        it('should still invoke the spec', function() {
          var executed = false
          shim.record(wrappable, 'bar', function() {
            executed = true
          })

          helper.runInTransaction(agent, function(tx) {
            tx.end()
            wrappable.bar('a', 'b', 'c')
            expect(executed).to.be.true
          })
        })

        it('should not bind the callback if there is one', function() {
          var cb = function() {}
          var toWrap = function(wrappedCB) {
            expect(wrappedCB).to.equal(cb)
            expect(shim.isWrapped(wrappedCB)).to.be.false
          }
          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment', callback: shim.LAST}
          })

          helper.runInTransaction(agent, function(tx) {
            tx.end()
            wrapped(cb)
          })
        })

        it('should not bind the rowCallback if there is one', function() {
          var cb = function() {}
          var toWrap = function(wrappedCB) {
            expect(wrappedCB).to.equal(cb)
            expect(shim.isWrapped(wrappedCB)).to.be.false
          }
          var wrapped = shim.record(toWrap, function() {
            return {name: 'test segment', rowCallback: shim.LAST}
          })

          helper.runInTransaction(agent, function(tx) {
            tx.end()
            wrapped(cb)
          })
        })
      })
    })
  })

  describe('#isWrapped', function() {
    describe('without a property', function() {
      it('should return true if the object was wrapped', function() {
        var toWrap = function() {}
        expect(shim.isWrapped(toWrap)).to.be.false

        var wrapped = shim.wrap(toWrap, function() { return function() {} })
        expect(shim.isWrapped(wrapped)).to.be.true
      })

      it('should not error if the object is `null`', function() {
        expect(function() {
          shim.isWrapped(null)
        }).to.not.throw()

        expect(shim.isWrapped(null)).to.be.false
      })
    })

    describe('with a property', function() {
      it('should return true if the property was wrapped', function() {
        expect(shim.isWrapped(wrappable, 'bar')).to.be.false

        shim.wrap(wrappable, 'bar', function() { return function() {} })
        expect(shim.isWrapped(wrappable, 'bar')).to.be.true
      })

      it('should not error if the object is `null`', function() {
        expect(function() {
          shim.isWrapped(null, 'bar')
        }).to.not.throw()
        expect(shim.isWrapped(null, 'bar')).to.be.false
      })

      it('should not error if the property is `null`', function() {
        expect(function() {
          shim.isWrapped(wrappable, 'this does not exist')
        }).to.not.throw()
        expect(shim.isWrapped(wrappable, 'this does not exist')).to.be.false
      })
    })
  })

  describe('#unwrap', function() {
    var original
    var wrapped

    beforeEach(function() {
      original = function() {}
      wrapped = shim.wrap(original, function() { return function() {} })
      shim.wrap(wrappable, ['bar', 'fiz', 'getActiveSegment'], function() {
        return function() {}
      })
    })

    it('should not error if the item is not wrapped', function() {
      expect(function() {
        shim.unwrap(original)
      }).to.not.throw()
      expect(shim.unwrap(original)).to.equal(original)
    })

    it('should fully unwrap nested wrappers', function() {
      for (var i = 0; i < 10; ++i) {
        wrapped = shim.wrap(wrapped, function() { return function() {} })
      }

      expect(wrapped).to.not.equal(original)
      expect(wrapped.__NR_original).to.not.equal(original)
      expect(shim.unwrap(wrapped)).to.equal(original)
    })

    describe('with no properties', function() {
      it('should unwrap the first parameter', function() {
        expect(shim.unwrap(wrapped)).to.equal(original)
      })

      it('should not error if `nodule` is `null`', function() {
        expect(function() {
          shim.unwrap(null)
        }).to.not.throw()
      })
    })

    describe('with properties', function() {
      it('should accept a single property', function() {
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(function() {
          shim.unwrap(wrappable, 'bar')
        }).to.not.throw()
        expect(shim.isWrapped(wrappable.bar)).to.be.false
      })

      it('should accept an array of properties', function() {
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.isWrapped(wrappable.fiz)).to.be.true
        expect(shim.isWrapped(wrappable.getActiveSegment)).to.be.true
        expect(function() {
          shim.unwrap(wrappable, ['bar', 'fiz', 'getActiveSegment'])
        }).to.not.throw()
        expect(shim.isWrapped(wrappable.bar)).to.be.false
        expect(shim.isWrapped(wrappable.fiz)).to.be.false
        expect(shim.isWrapped(wrappable.getActiveSegment)).to.be.false
      })

      it('should not error if a nodule is `null`', function() {
        expect(function() {
          shim.unwrap(null, 'bar')
        }).to.not.throw()
      })

      it('should not error if a property is `null`', function() {
        expect(function() {
          shim.unwrap(wrappable, 'this does not exist')
        }).to.not.throw()
      })
    })
  })

  describe('#unwrapOnce', function() {
    var original
    var wrapped

    beforeEach(function() {
      original = function() {}
      wrapped = shim.wrap(original, function() { return function() {} })
      shim.wrap(wrappable, ['bar', 'fiz', 'getActiveSegment'], function() {
        return function() {}
      })
    })

    it('should not error if the item is not wrapped', function() {
      expect(function() {
        shim.unwrapOnce(original)
      }).to.not.throw()
      expect(shim.unwrapOnce(original)).to.equal(original)
    })

    it('should not fully unwrap multiple nested wrappers', function() {
      for (var i = 0; i < 10; ++i) {
        wrapped = shim.wrap(wrapped, function() { return function() {} })
      }

      expect(wrapped).to.not.equal(original)
      expect(wrapped.__NR_original).to.not.equal(original)
      expect(shim.unwrapOnce(wrapped)).to.not.equal(original)
    })

    describe('with no properties', function() {
      it('should unwrap the first parameter', function() {
        expect(shim.unwrapOnce(wrapped)).to.equal(original)
      })

      it('should not error if `nodule` is `null`', function() {
        expect(function() {
          shim.unwrapOnce(null)
        }).to.not.throw()
      })
    })

    describe('with properties', function() {
      it('should accept a single property', function() {
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(function() {
          shim.unwrapOnce(wrappable, 'bar')
        }).to.not.throw()
        expect(shim.isWrapped(wrappable.bar)).to.be.false
      })

      it('should accept an array of properties', function() {
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.isWrapped(wrappable.fiz)).to.be.true
        expect(shim.isWrapped(wrappable.getActiveSegment)).to.be.true
        expect(function() {
          shim.unwrapOnce(wrappable, ['bar', 'fiz', 'getActiveSegment'])
        }).to.not.throw()
        expect(shim.isWrapped(wrappable.bar)).to.be.false
        expect(shim.isWrapped(wrappable.fiz)).to.be.false
        expect(shim.isWrapped(wrappable.getActiveSegment)).to.be.false
      })

      it('should not error if a nodule is `null`', function() {
        expect(function() {
          shim.unwrapOnce(null, 'bar')
        }).to.not.throw()
      })

      it('should not error if a property is `null`', function() {
        expect(function() {
          shim.unwrapOnce(wrappable, 'this does not exist')
        }).to.not.throw()
      })
    })
  })

  describe('#getSegment', function() {
    var segment = null

    beforeEach(function() {
      segment = {probe: function() {}}
    })

    it('should return the segment a function is bound to', function() {
      var bound = shim.bindSegment(function() {}, segment)
      expect(shim.getSegment(bound)).to.equal(segment)
    })

    it('should return the current segment if the function is not bound', function() {
      agent.tracer.segment = segment
      expect(shim.getSegment(function() {})).to.equal(segment)
    })

    it('should return the current segment if no object is provided', function() {
      agent.tracer.segment = segment
      expect(shim.getSegment()).to.equal(segment)
    })
  })

  describe('#getActiveSegment', function() {
    var segment = null

    beforeEach(function() {
      segment = {
        probe: function() {},
        transaction: {
          active: true,
          isActive: function() { return this.active }
        }
      }
    })

    describe('when the transaction is active', function() {
      it('should return the segment a function is bound to', function() {
        var bound = shim.bindSegment(function() {}, segment)
        expect(shim.getActiveSegment(bound)).to.equal(segment)
      })

      it('should return the current segment if the function is not bound', function() {
        agent.tracer.segment = segment
        expect(shim.getActiveSegment(function() {})).to.equal(segment)
      })

      it('should return the current segment if no object is provided', function() {
        agent.tracer.segment = segment
        expect(shim.getActiveSegment()).to.equal(segment)
      })
    })

    describe('when the transaction is not active', function() {
      beforeEach(function() {
        segment.transaction.active = false
      })

      it('should return null for a bound function', function() {
        var bound = shim.bindSegment(function() {}, segment)
        expect(shim.getActiveSegment(bound)).to.be.null
      })

      it('should return null if the function is not bound', function() {
        agent.tracer.segment = segment
        expect(shim.getActiveSegment(function() {})).to.be.null
      })

      it('should return null if no object is provided', function() {
        agent.tracer.segment = segment
        expect(shim.getActiveSegment()).to.be.null
      })
    })
  })

  describe('#storeSegment', function() {
    describe('when hide_internals is true', function() {
      beforeEach(function() {
        agent.config.transaction_tracer.hide_internals = true
      })

      it('should set a non-enumerable property on the object', function() {
        var keys = Object.keys(wrappable)
        shim.storeSegment(wrappable, {})
        expect(Object.keys(wrappable)).to.deep.equal(keys)
      })
    })

    it('should store the segment on the object', function() {
      var segment = { probe: function() {} }
      shim.storeSegment(wrappable, segment)
      expect(shim.getSegment(wrappable)).to.equal(segment)
    })

    it('should default to the current segment', function() {
      var segment = { probe: function() {} }
      agent.tracer.segment = segment
      shim.storeSegment(wrappable)
      expect(shim.getSegment(wrappable)).to.equal(segment)
    })

    it('should not fail if the object is `null`', function() {
      expect(function() {
        shim.storeSegment(null)
      }).to.not.throw()
    })
  })

  describe('#bindCallbackSegment', function() {
    var cbCalled = false
    var cb = null

    beforeEach(function() {
      cbCalled = false
      cb = function() {
        cbCalled = true
      }
    })

    it('should wrap the callback in place', function() {
      var args = ['a', cb, 'b']
      shim.bindCallbackSegment(args, shim.SECOND)

      var wrapped = args[1]
      expect(wrapped)
        .to.be.an.instanceof(Function)
        .and.not.equal(cb)
      expect(args).to.deep.equal(['a', wrapped, 'b'])
      expect(shim.isWrapped(wrapped)).to.be.true
      expect(shim.unwrap(wrapped)).to.equal(cb)
    })

    it('should work with an array and numeric index', function() {
      var args = ['a', cb, 'b']
      shim.bindCallbackSegment(args, 1)
      expect(shim.isWrapped(args[1])).to.be.true
    })

    it('should work with an object and a string index', function() {
      var opts = {a: 'a', cb: cb, b: 'b'}
      shim.bindCallbackSegment(opts, 'cb')
      expect(shim.isWrapped(opts, 'cb')).to.be.true
    })

    it('should not error if `args` is `null`', function() {
      expect(function() {
        shim.bindCallbackSegment(null, 1)
      }).to.not.throw()
    })

    it('should not error if the callback does not exist', function() {
      expect(function() {
        var args = ['a']
        shim.bindCallbackSegment(args, 1)
      }).to.not.throw()
    })

    it('should not bind if the "callback" is not a function', function() {
      expect(function() {
        var args = ['a']
        shim.bindCallbackSegment(args, 0)
      }).to.not.throw()

      var args = ['a']
      shim.bindCallbackSegment(args, 0)
      expect(shim.isWrapped(args[0])).to.be.false
      expect(args[0]).to.equal('a')
    })

    describe('wrapper', function() {
      it('should execute the callback', function() {
        var args = ['a', 'b', cb]
        shim.bindCallbackSegment(args, shim.LAST)

        expect(cbCalled).to.be.false
        args[2]()
        expect(cbCalled).to.be.true
      })

      it('should create a new segment', function() {
        helper.runInTransaction(agent, function() {
          var args = [wrappable.getActiveSegment]
          var segment = wrappable.getActiveSegment()
          var parent = shim.createSegment('test segment')
          shim.bindCallbackSegment(args, shim.LAST, parent)
          var cbSegment = args[0]()

          expect(cbSegment)
            .to.not.equal(segment)
            .and.not.equal(parent)
          expect(parent)
            .to.have.property('children')
            .that.deep.equals([cbSegment])
        })
      })

      it('should make the `parentSegment` translucent after running', function() {
        helper.runInTransaction(agent, function() {
          var args = [wrappable.getActiveSegment]
          var parent = shim.createSegment('test segment')
          parent.opaque = true
          shim.bindCallbackSegment(args, shim.LAST, parent)
          var cbSegment = args[0]()

          expect(cbSegment)
            .to.not.equal(parent)
          expect(parent)
            .to.have.property('children')
            .that.deep.equals([cbSegment])
          expect(parent.opaque).to.be.false
        })
      })

      it('should default the `parentSegment` to the current one', function() {
        helper.runInTransaction(agent, function() {
          var args = [wrappable.getActiveSegment]
          var segment = wrappable.getActiveSegment()
          shim.bindCallbackSegment(args, shim.LAST)
          var cbSegment = args[0]()

          expect(cbSegment)
            .to.not.equal(segment)
          expect(segment)
            .to.have.property('children')
            .that.deep.equals([cbSegment])
        })
      })
    })
  })

  describe('#applySegment', function() {
    var segment

    beforeEach(function() {
      segment = {
        name: 'segment',
        started: false,
        touched: false,
        start: function() { this.started = true },
        touch: function() { this.touched = true },
        probe: function() { this.probed = true }
      }
    })

    it('should call the function with the `context` and `args`', function() {
      var context = {name: 'context'}
      var value = {name: 'value'}
      var ret = shim.applySegment(function(a, b, c) {
        expect(this).to.equal(context)
        expect(arguments.length).to.equal(3)
        expect(a).to.equal('a')
        expect(b).to.equal('b')
        expect(c).to.equal('c')
        return value
      }, segment, false, context, ['a', 'b', 'c'])

      expect(ret).to.equal(value)
    })

    it('should execute the inContext callback under the produced segment', function() {
      shim.applySegment(function() {}, segment, false, {}, [], function checkSegment() {
        expect(agent.tracer.segment).to.equal(segment)
      })
    })

    it('should make the segment active for the duration of execution', function() {
      var prevSegment = {name: 'prevSegment', probe: function() {}}
      agent.tracer.segment = prevSegment
      var activeSegment = shim.applySegment(wrappable.getActiveSegment, segment)
      expect(agent.tracer.segment).to.equal(prevSegment)
      expect(activeSegment).to.equal(segment)
      expect(segment).to.have.property('touched', false)
      expect(segment).to.have.property('started', false)
    })

    it('should start and touch the segment if `full` is `true`', function() {
      shim.applySegment(wrappable.getActiveSegment, segment, true)
      expect(segment).to.have.property('touched', true)
      expect(segment).to.have.property('started', true)
    })

    it('should not change the active segment if `segment` is `null`', function() {
      agent.tracer.segment = segment
      var activeSegment = null
      expect(function() {
        activeSegment = shim.applySegment(wrappable.getActiveSegment, null)
      }).to.not.throw()
      expect(agent.tracer.segment).to.equal(segment)
      expect(activeSegment).to.equal(segment)
    })

    describe('when `func` has no `.apply` method', () => {
      let func = null
      beforeEach(() => {
        func = function() {}
        func.__proto__ = {}
      })

      it('should not throw in a transaction', () => {
        expect(func).to.not.have.property('apply')
        expect(() => shim.applySegment(func, segment)).to.not.throw()
      })

      it('should not throw out of a transaction', () => {
        expect(func).to.not.have.property('apply')
        expect(() => shim.applySegment(func, null)).to.not.throw()
      })
    })

    describe('when `func` throws an exception', function() {
      var func = null

      beforeEach(function() {
        func = function() {
          throw new Error('test error')
        }
      })

      it('should not swallow the exception', function() {
        expect(function() {
          shim.applySegment(func, segment)
        }).to.throw(Error, 'test error')
      })

      it('should still return the active segment to the previous one', function() {
        var prevSegment = {name: 'prevSegment', probe: function() {}}
        agent.tracer.segment = prevSegment

        expect(function() {
          shim.applySegment(func, segment)
        }).to.throw(Error, 'test error')

        expect(agent.tracer.segment).to.equal(prevSegment)
      })
      it('should still touch the segment if `full` is `true`', function() {
        expect(function() {
          shim.applySegment(func, segment, true)
        }).to.throw(Error, 'test error')

        expect(segment).to.have.property('touched', true)
      })
    })
  })

  describe('#createSegment', function() {
    it('should create a segment with the correct name', function() {
      helper.runInTransaction(agent, function() {
        var segment = shim.createSegment('foobar')
        expect(segment).to.have.property('name', 'foobar')
      })
    })

    it('should allow `recorder` to be omitted', function() {
      helper.runInTransaction(agent, function() {
        var parent = shim.createSegment('parent')
        var child = shim.createSegment('child', parent)
        expect(child).to.have.property('name', 'child')
        expect(parent)
          .to.have.property('children')
          .that.deep.equals([child])
      })
    })

    it('should allow `recorder` to be null', function() {
      helper.runInTransaction(agent, function() {
        var parent = shim.createSegment('parent')
        var child = shim.createSegment('child', null, parent)
        expect(child).to.have.property('name', 'child')
        expect(parent)
          .to.have.property('children')
          .that.deep.equals([child])
      })
    })

    it('should not create children for opaque segments', function() {
      helper.runInTransaction(agent, function() {
        var parent = shim.createSegment('parent')
        parent.opaque = true
        var child = shim.createSegment('child', parent)
        expect(child).to.have.property('name', 'parent')
        expect(parent)
          .to.have.property('children')
          .that.deep.equals([])
      })
    })

    describe('when parent passed in args', () => {
      it('should not modify returned parent for opaque segments', () => {
        helper.runInTransaction(agent, () => {
          const parent = shim.createSegment('parent')
          parent.opaque = true
          parent.internal = true

          const child = shim.createSegment('child', parent)

          expect(child).to.equal(parent)
          expect(parent).to.have.property('opaque', true)
          expect(parent).to.have.property('internal', true)
        })
      })
    })

    describe('when parent not passed in args', () => {
      it('should default to the current segment as the parent', function() {
        helper.runInTransaction(agent, function() {
          var parent = shim.getSegment()
          var child = shim.createSegment('child')
          expect(parent)
            .to.have.property('children')
            .that.deep.equals([child])
        })
      })

      it('should not modify returned parent for opaque segments', () => {
        helper.runInTransaction(agent, () => {
          const parent = shim.createSegment('parent')
          parent.opaque = true
          parent.internal = true

          shim.setActiveSegment(parent)

          const child = shim.createSegment('child')

          expect(child).to.equal(parent)
          expect(parent).to.have.property('opaque', true)
          expect(parent).to.have.property('internal', true)
        })
      })
    })

    it('should work with all parameters in an object', function() {
      helper.runInTransaction(agent, function() {
        var parent = shim.createSegment('parent')
        var child = shim.createSegment({name: 'child', parent: parent})
        expect(child).to.have.property('name', 'child')
        expect(parent)
          .to.have.property('children')
          .that.deep.equals([child])
      })
    })

    describe('when an `parameters` object is provided', function() {
      var segment = null
      var parameters = null

      beforeEach(function() {
        parameters = {
          host: 'my awesome host',
          port_path_or_id: 1234,
          database_name: 'my_db',
          foo: 'bar',
          fiz: 'bang',
          ignore_me: 'baz'
        }

        agent.config.attributes.exclude = [
          'ignore_me',
          'host',
          'port_path_or_id',
          'database_name'
        ]
        agent.config.emit('attributes.exclude')
      })

      describe('and attributes.enabled is true', function() {
        beforeEach(function() {
          agent.config.attributes.enabled = true
          helper.runInTransaction(agent, function() {
            segment = shim.createSegment({name: 'child', parameters: parameters})
          })
        })

        it('should copy parameters provided into `segment.parameters`', function() {
          expect(segment).to.have.property('attributes')
          const attributes = segment.getAttributes()
          expect(attributes).to.have.property('foo', 'bar')
          expect(attributes).to.have.property('fiz', 'bang')
        })

        it('should be affected by `attributes.exclude`', function() {
          expect(segment).to.have.property('attributes')
          const attributes = segment.getAttributes()
          expect(attributes).to.have.property('foo', 'bar')
          expect(attributes).to.have.property('fiz', 'bang')
          expect(attributes).to.not.have.property('ignore_me')
          expect(attributes).to.not.have.property('host')
          expect(attributes).to.not.have.property('port_path_or_id')
          expect(attributes).to.not.have.property('database_name')
        })
      })

      describe('and attributes.enabled is false', function() {
        beforeEach(function() {
          agent.config.attributes.enabled = false
          helper.runInTransaction(agent, function() {
            segment = shim.createSegment({name: 'child', parameters})
          })
        })

        it('should not copy parameters into segment attributes', function() {
          expect(segment).to.have.property('attributes')
          const attributes = segment.getAttributes()
          expect(attributes).to.not.have.property('foo')
          expect(attributes).to.not.have.property('fiz')
          expect(attributes).to.not.have.property('ignore_me')
          expect(attributes).to.not.have.property('host')
          expect(attributes).to.not.have.property('port_path_or_id')
          expect(attributes).to.not.have.property('database_name')
        })
      })
    })
  })

  describe('#getName', function() {
    it('should return the `name` property of an object if it has one', function() {
      expect(shim.getName({name: 'foo'})).to.equal('foo')
      expect(shim.getName(function bar() {})).to.equal('bar')
    })

    it('should return "<anonymous>" if the object has no name', function() {
      expect(shim.getName({})).to.equal('<anonymous>')
      expect(shim.getName(function() {})).to.equal('<anonymous>')
    })
  })

  describe('#isObject', function() {
    it('should detect if an item is an object', function() {
      expect(shim.isObject({})).to.be.true
      expect(shim.isObject([])).to.be.true
      expect(shim.isObject(arguments)).to.be.true
      expect(shim.isObject(function() {})).to.be.true
      expect(shim.isObject(true)).to.be.false
      expect(shim.isObject(false)).to.be.false
      expect(shim.isObject('foobar')).to.be.false
      expect(shim.isObject(1234)).to.be.false
      expect(shim.isObject(null)).to.be.false
      expect(shim.isObject(undefined)).to.be.false
    })
  })

  describe('#isFunction', function() {
    it('should detect if an item is a function', function() {
      expect(shim.isFunction({})).to.be.false
      expect(shim.isFunction([])).to.be.false
      expect(shim.isFunction(arguments)).to.be.false
      expect(shim.isFunction(function() {})).to.be.true
      expect(shim.isFunction(true)).to.be.false
      expect(shim.isFunction(false)).to.be.false
      expect(shim.isFunction('foobar')).to.be.false
      expect(shim.isFunction(1234)).to.be.false
      expect(shim.isFunction(null)).to.be.false
      expect(shim.isFunction(undefined)).to.be.false
    })
  })

  describe('#isString', function() {
    it('should detect if an item is a string', function() {
      expect(shim.isString({})).to.be.false
      expect(shim.isString([])).to.be.false
      expect(shim.isString(arguments)).to.be.false
      expect(shim.isString(function() {})).to.be.false
      expect(shim.isString(true)).to.be.false
      expect(shim.isString(false)).to.be.false
      expect(shim.isString('foobar')).to.be.true
      expect(shim.isString(1234)).to.be.false
      expect(shim.isString(null)).to.be.false
      expect(shim.isString(undefined)).to.be.false
    })
  })

  describe('#isNumber', function() {
    it('should detect if an item is a number', function() {
      expect(shim.isNumber({})).to.be.false
      expect(shim.isNumber([])).to.be.false
      expect(shim.isNumber(arguments)).to.be.false
      expect(shim.isNumber(function() {})).to.be.false
      expect(shim.isNumber(true)).to.be.false
      expect(shim.isNumber(false)).to.be.false
      expect(shim.isNumber('foobar')).to.be.false
      expect(shim.isNumber(1234)).to.be.true
      expect(shim.isNumber(null)).to.be.false
      expect(shim.isNumber(undefined)).to.be.false
    })
  })

  describe('#isBoolean', function() {
    it('should detect if an item is a boolean', function() {
      expect(shim.isBoolean({})).to.be.false
      expect(shim.isBoolean([])).to.be.false
      expect(shim.isBoolean(arguments)).to.be.false
      expect(shim.isBoolean(function() {})).to.be.false
      expect(shim.isBoolean(true)).to.be.true
      expect(shim.isBoolean(false)).to.be.true
      expect(shim.isBoolean('foobar')).to.be.false
      expect(shim.isBoolean(1234)).to.be.false
      expect(shim.isBoolean(null)).to.be.false
      expect(shim.isBoolean(undefined)).to.be.false
    })
  })

  describe('#isArray', function() {
    it('should detect if an item is an array', function() {
      expect(shim.isArray({})).to.be.false
      expect(shim.isArray([])).to.be.true
      expect(shim.isArray(arguments)).to.be.false
      expect(shim.isArray(function() {})).to.be.false
      expect(shim.isArray(true)).to.be.false
      expect(shim.isArray(false)).to.be.false
      expect(shim.isArray('foobar')).to.be.false
      expect(shim.isArray(1234)).to.be.false
      expect(shim.isArray(null)).to.be.false
      expect(shim.isArray(undefined)).to.be.false
    })
  })

  describe('#isNull', function() {
    it('should detect if an item is null', function() {
      expect(shim.isNull(null)).to.be.true
      expect(shim.isNull({})).to.be.false
      expect(shim.isNull([])).to.be.false
      expect(shim.isNull(arguments)).to.be.false
      expect(shim.isNull(function() {})).to.be.false
      expect(shim.isNull(true)).to.be.false
      expect(shim.isNull(false)).to.be.false
      expect(shim.isNull('foobar')).to.be.false
      expect(shim.isNull(1234)).to.be.false
      expect(shim.isNull(undefined)).to.be.false
    })
  })

  describe('#toArray', function() {
    it('should convert array-like objects into arrays', function() {
      var res = ['a', 'b', 'c', 'd']
      expect(shim.toArray(res))
        .to.deep.equal(res)
        .and.be.an.instanceof(Array)

      expect(shim.toArray('abcd'))
        .to.deep.equal(res)
        .and.be.an.instanceof(Array)

      argumentsTest.apply(null, res)
      function argumentsTest() {
        expect(shim.toArray(arguments))
          .to.deep.equal(res)
          .and.be.an.instanceof(Array)
      }
    })
  })

  describe('#normalizeIndex', function() {
    var args = null

    beforeEach(function() {
      args = [1, 2, 3, 4]
    })

    it('should return the index if it is already normal', function() {
      expect(shim.normalizeIndex(args.length, 0)).to.equal(0)
      expect(shim.normalizeIndex(args.length, 1)).to.equal(1)
      expect(shim.normalizeIndex(args.length, 3)).to.equal(3)
    })

    it('should offset negative indexes from the end of the array', function() {
      expect(shim.normalizeIndex(args.length, -1)).to.equal(3)
      expect(shim.normalizeIndex(args.length, -2)).to.equal(2)
      expect(shim.normalizeIndex(args.length, -4)).to.equal(0)
    })

    it('should return `null` for invalid indexes', function() {
      expect(shim.normalizeIndex(args.length, 4)).to.be.null
      expect(shim.normalizeIndex(args.length, 10)).to.be.null
      expect(shim.normalizeIndex(args.length, -5)).to.be.null
      expect(shim.normalizeIndex(args.length, -10)).to.be.null
    })
  })

  describe('#setInternalProperty', function() {
    beforeEach(function() {
      sinon.spy(Object, 'defineProperty')
    })

    afterEach(function() {
      Object.defineProperty.restore()
    })

    describe('when hide_internals is true', function() {
      beforeEach(function() {
        agent.config.transaction_tracer.hide_internals = true
      })

      it('should create a writable, non-enumerable value property', function() {
        // Non enumerable
        var obj = {}
        shim.setInternalProperty(obj, 'foo', 'bar')
        expect(obj).to.have.property('foo', 'bar')
        expect(Object.keys(obj)).to.not.include('foo')

        // Writable
        expect(function() {
          obj.foo = 'fizbang'
        }).to.not.throw()
        expect(obj).to.have.property('foo', 'fizbang')
        expect(Object.keys(obj)).to.not.include('foo')
      })

      it('should not throw if the object has been frozen', function() {
        var obj = {}
        Object.freeze(obj)

        /* eslint-disable strict */
        expect(function() {
          'use strict'
          obj.fiz = 'bang'
        }).to.throw()
        /* eslint-enable strict */

        expect(function() {
          shim.setInternalProperty(obj, 'foo', 'bar')
        }).to.not.throw()
      })

      it('should not throw if the property has been sealed', function() {
        var obj = {}
        Object.seal(obj)

        /* eslint-disable strict */
        expect(function() {
          'use strict'
          obj.fiz = 'bang'
        }).to.throw()
        /* eslint-enable strict */

        expect(function() {
          shim.setInternalProperty(obj, 'foo', 'bar')
        }).to.not.throw()
      })
    })

    describe('when hide_internals is false', function() {
      beforeEach(function() {
        agent.config.transaction_tracer.hide_internals = false
      })

      it('should create a writable, enumerable value property', function() {
        // Enumerable
        var obj = {}
        shim.setInternalProperty(obj, 'foo', 'bar')
        expect(obj).to.have.property('foo', 'bar')
        expect(Object.keys(obj)).to.include('foo')

        // Writable
        expect(function() {
          obj.foo = 'fizbang'
        }).to.not.throw()
        expect(obj).to.have.property('foo', 'fizbang')
        expect(Object.keys(obj)).to.include('foo')
      })

      it('should not use defineProperty', function() {
        var obj = {}
        shim.setInternalProperty(obj, 'foo', 'bar')

        expect(Object.defineProperty.calledOnce).to.be.false
      })

      it('should not throw if the object has been frozen', function() {
        var obj = {}
        Object.freeze(obj)

        /* eslint-disable strict */
        expect(function() {
          'use strict'
          obj.fiz = 'bang'
        }).to.throw()
        /* eslint-enable strict */

        expect(function() {
          shim.setInternalProperty(obj, 'foo', 'bar')
        }).to.not.throw()
      })

      it('should not throw if the property has been sealed', function() {
        var obj = {}
        Object.seal(obj)

        /* eslint-disable strict */
        expect(function() {
          'use strict'
          obj.fiz = 'bang'
        }).to.throw()
        /* eslint-enable strict */

        expect(function() {
          shim.setInternalProperty(obj, 'foo', 'bar')
        }).to.not.throw()
      })
    })
  })

  describe('#defineProperty', function() {
    it('should create an enumerable, configurable property', function() {
      var obj = {}
      shim.defineProperty(obj, 'foo', 'bar')
      var descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      expect(descriptor).to.have.property('configurable', true)
      expect(descriptor).to.have.property('enumerable', true)
    })

    it('should create an unwritable property when `value` is not a function', function() {
      var obj = {}
      shim.defineProperty(obj, 'foo', 'bar')
      var descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      expect(descriptor).to.have.property('writable', false)
      expect(descriptor).to.not.have.property('get')
      expect(descriptor).to.have.property('value', 'bar')
    })

    it('should create a getter when `value` is a function', function() {
      var obj = {}
      shim.defineProperty(obj, 'foo', function() { return 'bar' })
      var descriptor = Object.getOwnPropertyDescriptor(obj, 'foo')

      expect(descriptor).to.have.property('configurable', true)
      expect(descriptor).to.have.property('enumerable', true)
      expect(descriptor).to.have.property('get').that.is.an.instanceof(Function)
      expect(descriptor).to.not.have.property('value')
    })
  })

  describe('#defineProperties', function() {
    it('should create properties for each key on `props`', function() {
      var obj = {}
      var props = {foo: 'bar', fiz: 'bang'}
      shim.defineProperties(obj, props)

      expect(obj).to.have.property('foo', 'bar')
      expect(obj).to.have.property('fiz', 'bang')
    })
  })

  describe('#setDefaults', function() {
    it('should copy over defaults when provided object is null', function() {
      var obj = null
      var defaults = {foo: 1, bar: 2}
      var defaulted = shim.setDefaults(obj, defaults)

      expect(obj).to.not.equal(defaulted).and.not.equal(defaults)
      expect(defaulted).to.deep.equal(defaults)
    })

    it('should copy each key over', function() {
      var obj = {}
      var defaults = {foo: 1, bar: 2}
      var defaulted = shim.setDefaults(obj, defaults)

      expect(obj).to.equal(defaulted).and.not.equal(defaults)
      expect(defaulted).to.deep.equal(defaults)
    })

    it('should not replace existing keys', function() {
      var obj = {foo: null}
      var defaults = {foo: 1, bar: 2}
      var defaulted = shim.setDefaults(obj, defaults)

      expect(obj).to.equal(defaulted).and.not.equal(defaults)
      expect(defaulted).to.deep.equal({foo: null, bar: 2})
    })
  })

  describe('#proxy', function() {
    var original = null
    var proxied = null

    beforeEach(function() {
      original = {foo: 1, bar: 2, biz: 3, baz: 4}
      proxied = {}
    })

    afterEach(function() {
      original = null
      proxied = null
    })

    it('should proxy individual properties', function() {
      shim.proxy(original, 'foo', proxied)
      expect(original).to.have.property('foo', 1)
      expect(proxied).to.have.property('foo', 1)
      expect(proxied).to.not.have.property('bar')
      expect(proxied).to.not.have.property('biz')

      proxied.foo = 'other'
      expect(original).to.have.property('foo', 'other')
    })

    it('should proxy arrays of properties', function() {
      shim.proxy(original, ['foo', 'bar'], proxied)
      expect(original).to.have.property('foo', 1)
      expect(original).to.have.property('bar', 2)
      expect(proxied).to.have.property('foo', 1)
      expect(proxied).to.have.property('bar', 2)
      expect(proxied).to.not.have.property('biz')

      proxied.foo = 'other'
      expect(original).to.have.property('foo', 'other')
      expect(original).to.have.property('bar', 2)

      proxied.bar = 'another'
      expect(original).to.have.property('foo', 'other')
      expect(original).to.have.property('bar', 'another')
    })
  })
})

function testNonWritable(obj, key, value) {
  expect(function() {
    obj[key] = 'testNonWritable test value'
  }).to.throw(
    TypeError,
    new RegExp('(read only property \'' + key + '\'|Cannot set property ' + key + ')')
  )

  if (value) {
    expect(obj).to.have.property(key, value)
  } else {
    expect(obj).to.have.property(key)
      .that.is.not.equal('testNonWritable test value')
  }
}
