/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var API = require('../../../api')
var chai = require('chai')
var DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
var expect = chai.expect
var hashes = require('../../../lib/util/hashes')
var helper = require('../../lib/agent_helper')
var MessageShim = require('../../../lib/shim/message-shim')
var Promise = require('bluebird')


describe('MessageShim', function() {
  var agent = null
  var shim = null
  var wrappable = null
  var interval = null
  var tasks = []

  before(function() {
    interval = setInterval(function() {
      if (tasks.length) {
        tasks.pop()()
      }
    }, 10)
  })

  after(function() {
    clearInterval(interval)
  })

  beforeEach(function() {
    agent = helper.instrumentMockedAgent({
      span_events: {
        attributes: 
        { enabled: true,
          include: [
            'message.parameters.*'
          ] }
      }
    })
    shim = new MessageShim(agent, 'test-module')
    shim.setLibrary(shim.RABBITMQ)
    wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() { return 'fiz' },
      anony: function() {},
      getActiveSegment: function() {
        return agent.tracer.getSegment()
      },
      withNested: function() {
        const segment = agent.tracer.getSegment()
        segment.add('ChildSegment')

        return segment
      }
    }

    var params = {
      encoding_key: 'this is an encoding key',
      cross_process_id: '1234#4321'
    }
    agent.config.trusted_account_ids = [9876, 6789]
    agent.config._fromServer(params, 'encoding_key')
    agent.config._fromServer(params, 'cross_process_id')
  })

  afterEach(function() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  describe('constructor', function() {
    it('should require an agent parameter', function() {
      expect(function() { return new MessageShim() })
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })

    it('should require a module name parameter', function() {
      expect(function() { return new MessageShim(agent) })
        .to.throw(Error, /^Shim must be initialized with .*? module name/)
    })
  })

  describe('well-known message libraries', function() {
    var messageLibs = ['RABBITMQ']

    it('should be enumerated on the class and prototype', function() {
      messageLibs.forEach(function(lib) {
        testNonWritable(MessageShim, lib)
        testNonWritable(shim, lib)
      })
    })
  })

  describe('well-known destination types', function() {
    var messageLibs = ['EXCHANGE', 'QUEUE', 'TOPIC']

    it('should be enumerated on the class and prototype', function() {
      messageLibs.forEach(function(lib) {
        testNonWritable(MessageShim, lib)
        testNonWritable(shim, lib)
      })
    })
  })

  describe('#setLibrary', function() {
    it('should create broker metric names', function() {
      var s = new MessageShim(agent, 'test')
      expect(s._metrics).to.not.exist
      s.setLibrary('foobar')
      expect(s._metrics).to.have.property('PREFIX', 'MessageBroker/')
      expect(s._metrics).to.have.property('LIBRARY', 'foobar')
    })

    it('should update the shim\'s logger', function() {
      var s = new MessageShim(agent, 'test')
      var logger = s.logger
      s.setLibrary('foobar')
      expect(s.logger).to.not.equal(logger)
    })
  })

  describe('#recordProduce', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordProduce(wrappable, function() {})
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordProduce(wrappable.bar, function() {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordProduce(wrappable.bar, null, function() {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordProduce(wrappable, 'bar', function() {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordProduce(wrappable, 'name', function() {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      it('should create a produce segment', function() {
        shim.recordProduce(wrappable, 'getActiveSegment', function() {
          return {destinationName: 'foobar'}
        })

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          var segment = wrappable.getActiveSegment()
          expect(segment).to.not.equal(startingSegment)
          expect(segment.transaction).to.equal(tx)
          expect(segment.name)
            .to.equal('MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')

          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should add parameters to segment', function() {
        shim.recordProduce(wrappable, 'getActiveSegment', function() {
          return {
            routingKey: 'foo.bar',
            parameters: {a: 'a', b: 'b'}
          }
        })

        helper.runInTransaction(agent, function() {
          var segment = wrappable.getActiveSegment()
          const attributes = segment.getAttributes()
          expect(attributes).to.have.property('routing_key', 'foo.bar')
          expect(attributes).to.have.property('a', 'a')
          expect(attributes).to.have.property('b', 'b')
        })
      })

      it('should not add parameters when disabled', function() {
        agent.config.message_tracer.segment_parameters.enabled = false
        shim.recordProduce(wrappable, 'getActiveSegment', function() {
          return {parameters: {
            a: 'a',
            b: 'b'
          }}
        })

        helper.runInTransaction(agent, function() {
          var segment = wrappable.getActiveSegment()
          const attributes = segment.getAttributes()
          expect(attributes).to.not.have.property('a')
          expect(attributes).to.not.have.property('b')
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordProduce(toWrap, function() {})

        helper.runInTransaction(agent, function() {
          expect(executed).to.be.false
          wrapped()
          expect(executed).to.be.true
        })
      })

      it('should invoke the spec in the context of the wrapped function', function() {
        var original = wrappable.bar
        var executed = false
        shim.recordProduce(wrappable, 'bar', function(_, fn, name, args) {
          executed = true
          expect(fn).to.equal(original)
          expect(name).to.equal('bar')
          expect(this).to.equal(wrappable)
          expect(args).to.deep.equal(['a', 'b', 'c'])

          return {destinationName: 'foobar'}
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

        var wrapped = shim.recordProduce(toWrap, function() {
          return {callback: shim.LAST}
        })

        helper.runInTransaction(agent, function() {
          wrapped(cb)
        })
      })

      it('should link the promise if one is returned', function() {
        var DELAY = 25
        var segment = null
        var val = {}
        var toWrap = function() {
          segment = shim.getSegment()
          return new Promise(function(res) {
            setTimeout(res, DELAY, val)
          })
        }

        var wrapped = shim.recordProduce(toWrap, function() {
          return {promise: true}
        })

        return helper.runInTransaction(agent, function() {
          return wrapped().then(function(v) {
            expect(v).to.equal(val)
            expect(segment.getDurationInMillis()).to.be.above(DELAY)
          })
        })
      })

      describe('when opaque false', () => {
        it('should create a child segment', function() {
          shim.recordProduce(wrappable, 'withNested', function() {
            return {destinationName: 'foobar'}
          })

          helper.runInTransaction(agent, (tx) => {
            const segment = wrappable.withNested()
            expect(segment.transaction).to.equal(tx)
            expect(segment.name)
              .to.equal('MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')

            expect(segment.children).to.have.lengthOf(1)
            const childSegment = segment.children[0]
            expect(childSegment.name).to.equal('ChildSegment')
          })
        })
      })

      describe('when opaque true', () => {
        it('should not create a child segment', function() {
          shim.recordProduce(wrappable, 'withNested', function() {
            return {destinationName: 'foobar', opaque: true}
          })

          helper.runInTransaction(agent, (tx) => {
            const segment = wrappable.withNested()
            expect(segment.transaction).to.equal(tx)
            expect(segment.name)
              .to.equal('MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')

            expect(segment.children).to.have.lengthOf(0)
          })
        })
      })

      describe('when headers are provided', function() {
        it('should insert CAT request headers', function() {
          var headers = {}
          shim.recordProduce(wrappable, 'getActiveSegment', function() {
            return {headers: headers}
          })

          helper.runInTransaction(agent, function() {
            wrappable.getActiveSegment()
            expect(headers).to.have.property('NewRelicID')
            expect(headers).to.have.property('NewRelicTransaction')
          })
        })
      })
    })

    describe('recorder', function() {
      var transaction = null

      beforeEach(function(done) {
        shim.recordProduce(wrappable, 'getActiveSegment', function() {
          return {destinationName: 'my-queue'}
        })

        helper.runInTransaction(agent, function(tx) {
          transaction = tx
          wrappable.getActiveSegment()
          tx.end()
          done()
        })
      })

      it('should create message broker metrics', function() {
        var unscoped = getMetrics(agent).unscoped
        var scoped = transaction.metrics.unscoped
        expect(unscoped).to.have.property(
          'MessageBroker/RabbitMQ/Exchange/Produce/Named/my-queue'
        )
        expect(scoped).to.have.property(
          'MessageBroker/RabbitMQ/Exchange/Produce/Named/my-queue'
        )
      })
    })
  })

  describe('#recordConsume', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordConsume(wrappable, function() {})
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordConsume(wrappable.bar, function() {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordConsume(wrappable.bar, null, function() {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordConsume(wrappable, 'bar', function() {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordConsume(wrappable, 'name', function() {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      beforeEach(function() {
        var params = {
          encoding_key: 'this is an encoding key',
          cross_process_id: '1234#4321'
        }
        agent.config.trusted_account_ids = [9876, 6789]
        agent.config._fromServer(params, 'encoding_key')
        agent.config._fromServer(params, 'cross_process_id')
      })

      it('should create a consume segment', function() {
        shim.recordConsume(wrappable, 'getActiveSegment', function() {
          return {destinationName: 'foobar'}
        })

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          var segment = wrappable.getActiveSegment()
          expect(segment).to.not.equal(startingSegment)
          expect(segment.transaction).to.equal(tx)
          expect(segment.name)
            .to.equal('MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')
          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should bind the callback if there is one', function() {
        const cb = function() {}
        const toWrap = function(wrappedCB) {
          expect(wrappedCB).to.not.equal(cb)
          expect(shim.isWrapped(wrappedCB)).to.be.true
          expect(shim.unwrap(wrappedCB)).to.equal(cb)

          expect(function() {
            wrappedCB()
          }).to.not.throw()
        }

        const wrapped = shim.recordConsume(toWrap, function() {
          return {callback: shim.LAST}
        })

        helper.runInTransaction(agent, function() {
          wrapped(cb)
        })
      })

      it('should add parameters to segment', function() {
        function wrapMe(q, cb) {
          cb()
          return shim.getSegment()
        }

        var wrapped = shim.recordConsume(wrapMe, {
          destinationName: shim.FIRST,
          callback: shim.LAST,
          messageHandler: function() {
            return {parameters: {a: 'a', b: 'b'}}
          }
        })

        helper.runInTransaction(agent, function() {
          var segment = wrapped('foo', function() {})
          const attributes = segment.getAttributes()
          expect(attributes).to.have.property('a', 'a')
          expect(attributes).to.have.property('b', 'b')
        })
      })

      it('should not add parameters when disabled', function() {
        agent.config.message_tracer.segment_parameters.enabled = false
        function wrapMe(q, cb) {
          cb()
          return shim.getSegment()
        }

        var wrapped = shim.recordConsume(wrapMe, {
          destinationName: shim.FIRST,
          callback: shim.LAST,
          messageHandler: function() {
            return {parameters: {a: 'a', b: 'b'}}
          }
        })

        helper.runInTransaction(agent, function() {
          var segment = wrapped('foo', function() {})
          const attributes = segment.getAttributes()
          expect(attributes).to.not.have.property('a')
          expect(attributes).to.not.have.property('b')
        })
      })

      it('should be able to get destinationName from arguments', function() {
        shim.recordConsume(wrappable, 'getActiveSegment', {
          destinationName: shim.FIRST,
          destinationType: shim.EXCHANGE
        })

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          var segment = wrappable.getActiveSegment('fizzbang')
          expect(segment).to.not.equal(startingSegment)
          expect(segment.transaction).to.equal(tx)
          expect(segment.name)
            .to.equal('MessageBroker/RabbitMQ/Exchange/Consume/Named/fizzbang')
          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should handle promise-based APIs', function() {
        var msg = {}
        var segment = null

        function wrapMe() {
          segment = shim.getSegment()
          return Promise.resolve(msg)
        }

        var wrapped = shim.recordConsume(wrapMe, {
          destinationName: shim.FIRST,
          promise: true,
          messageHandler: function(shim, fn, name, message) {
            expect(message).to.equal(msg)
            return {parameters: {a: 'a', b: 'b'}}
          }
        })

        return helper.runInTransaction(agent, function() {
          return wrapped('foo', function() {}).then(function(message) {
            expect(message).to.equal(msg)
            const attributes = segment.getAttributes()
            expect(attributes).to.have.property('a', 'a')
            expect(attributes).to.have.property('b', 'b')
          })
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordConsume(toWrap, function() {
          return {destinationName: 'foo'}
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
        shim.recordConsume(wrappable, 'bar', function(_, fn, name, args) {
          executed = true
          expect(fn).to.equal(original)
          expect(name).to.equal('bar')
          expect(this).to.equal(wrappable)
          expect(args).to.deep.equal(['a', 'b', 'c'])

          return {destinationName: 'foobar'}
        })

        helper.runInTransaction(agent, function() {
          wrappable.bar('a', 'b', 'c')
          expect(executed).to.be.true
        })
      })
    })

    describe('when opaque false', () => {
      it('should create a child segment', function() {
        shim.recordConsume(wrappable, 'withNested', function() {
          return {destinationName: 'foobar'}
        })

        helper.runInTransaction(agent, function(tx) {
          const segment = wrappable.withNested()
          expect(segment.transaction).to.equal(tx)
          expect(segment.name)
            .to.equal('MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')

          expect(segment.children).to.have.lengthOf(1)
          const childSegment = segment.children[0]
          expect(childSegment.name).to.equal('ChildSegment')
        })
      })
    })

    describe('when opaque true', () => {
      it('should not create a child segment', function() {
        shim.recordConsume(wrappable, 'withNested', function() {
          return {destinationName: 'foobar', opaque: true}
        })

        helper.runInTransaction(agent, function(tx) {
          const segment = wrappable.withNested()
          expect(segment.transaction).to.equal(tx)
          expect(segment.name)
            .to.equal('MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')

          expect(segment.children).to.have.lengthOf(0)
        })
      })
    })

    describe('recorder', function() {
      it('should create message broker metrics', function(done) {
        shim.recordConsume(wrappable, 'getActiveSegment', function() {
          return {destinationName: 'foobar'}
        })

        helper.runInTransaction(agent, function(tx) {
          wrappable.getActiveSegment()
          tx.finalizeName('test-transaction')
          setImmediate(tx.end.bind(tx))
        })

        agent.on('transactionFinished', function() {
          var metrics = getMetrics(agent)
          expect(metrics.unscoped).to.have.property(
            'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar'
          )
          expect(metrics.scoped).property('WebTransaction/test-transaction')
            .to.have.property('MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')
          done()
        })
      })
    })
  })

  describe('#recordPurgeQueue', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordPurgeQueue(wrappable, {})
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordPurgeQueue(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordPurgeQueue(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordPurgeQueue(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordPurgeQueue(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      it('should create a purge segment and metric', function() {
        shim.recordPurgeQueue(wrappable, 'getActiveSegment', {queue: shim.FIRST})

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          var segment = wrappable.getActiveSegment('foobar')
          expect(segment).to.not.equal(startingSegment)
          expect(segment.transaction).to.equal(tx)
          expect(segment.name)
            .to.equal('MessageBroker/RabbitMQ/Queue/Purge/Named/foobar')
          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should call the spec if it is not static', function() {
        var called = false

        shim.recordPurgeQueue(wrappable, 'getActiveSegment', function() {
          called = true
          return {queue: shim.FIRST}
        })

        helper.runInTransaction(agent, function() {
          expect(called).to.be.false
          wrappable.getActiveSegment('foobar')
          expect(called).to.be.true
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordPurgeQueue(toWrap, {})

        helper.runInTransaction(agent, function() {
          expect(executed).to.be.false
          wrapped()
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

        var wrapped = shim.recordPurgeQueue(toWrap, {callback: shim.LAST})

        helper.runInTransaction(agent, function() {
          wrapped(cb)
        })
      })

      it('should link the promise if one is returned', function() {
        var DELAY = 25
        var segment = null
        var val = {}
        var toWrap = function() {
          segment = shim.getSegment()
          return new Promise(function(res) {
            setTimeout(res, DELAY, val)
          })
        }

        var wrapped = shim.recordPurgeQueue(toWrap, {promise: true})

        return helper.runInTransaction(agent, function() {
          return wrapped().then(function(v) {
            expect(v).to.equal(val)
            expect(segment.getDurationInMillis()).to.be.above(DELAY - 1)
          })
        })
      })
    })

    describe('recorder', function() {
      var transaction = null

      beforeEach(function(done) {
        shim.recordPurgeQueue(wrappable, 'getActiveSegment', {queue: shim.FIRST})

        helper.runInTransaction(agent, function(tx) {
          transaction = tx
          wrappable.getActiveSegment('my-queue')
          tx.end()
          done()
        })
      })

      it('should create message broker metrics', function() {
        var unscoped = getMetrics(agent).unscoped
        var scoped = transaction.metrics.unscoped
        expect(unscoped).to.have.property(
          'MessageBroker/RabbitMQ/Queue/Purge/Named/my-queue'
        )
        expect(scoped).to.have.property(
          'MessageBroker/RabbitMQ/Queue/Purge/Named/my-queue'
        )
      })
    })
  })

  describe('#recordSubscribedConsume', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordSubscribedConsume(wrappable, {
        consumer: shim.FIRST,
        messageHandler: function() {}
      })
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordSubscribedConsume(wrappable.bar, {
          consumer: shim.FIRST,
          messageHandler: function() {},
          wrapper: function() {}
        })
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordSubscribedConsume(wrappable.bar, null,{
          consumer: shim.FIRST,
          messageHandler: function() {},
          wrapper: function() {}
        })
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordSubscribedConsume(wrappable, 'bar', {
          consumer: shim.FIRST,
          messageHandler: function() {},
          wrapper: function() {}
        })
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordSubscribedConsume(wrappable, 'name', {
          consumer: shim.FIRST,
          messageHandler: function() {},
          wrapper: function() {}
        })
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      var subscriber = null
      var messageHandler = null
      var wrapped = null
      var subscriberCalled = false
      var handlerCalled = false
      var message = null

      beforeEach(function() {
        message = {}
        subscriber = function consumeSubscriber(queue, consumer, cb) {
          subscriberCalled = true
          if (cb) {
            setImmediate(cb)
          }
          if (consumer) {
            setImmediate(consumer, message)
          }
          return shim.getSegment()
        }

        wrapped = shim.recordSubscribedConsume(subscriber, {
          name: 'Channel#subscribe',
          queue: shim.FIRST,
          consumer: shim.SECOND,
          callback: shim.LAST,
          messageHandler: function(shim) {
            handlerCalled = true
            if (messageHandler) {
              return messageHandler.apply(this, arguments)
            }
            return {
              destinationName: 'exchange.foo',
              destinationType: shim.EXCHANGE,
              routingKey: 'routing.key',
              properties: {
                queue_name: 'amq.randomQueueName'
              },
              parameters: {a: 'a', b: 'b'}
            }
          }
        })
      })

      afterEach(function() {
        message = null
        subscriber = null
        wrapped = null
        messageHandler = null
        subscriberCalled = false
        handlerCalled = false
      })

      it('should start a new transaction in the consumer', function(done) {
        var parent = wrapped('my.queue', function consumer() {
          var segment = shim.getSegment()
          expect(segment)
            .to.exist.and.have.property('name').not.equal('Callback: consumer')

          expect(segment).to.have.nested.property('transaction.type', 'message')
          done()
        })
        expect(parent).to.not.exist
      })

      it('should end the transaction immediately if not handled', function(done) {
        wrapped('my.queue', function consumer() {
          var tx = shim.getSegment().transaction
          expect(tx.isActive()).to.be.true
          setTimeout(function() {
            expect(tx.isActive()).to.be.false
            done()
          }, 5)
        })
      })

      it('should end the transaction based on a promise', function(done) {
        messageHandler = function() {
          return {promise: true}
        }

        wrapped('my.queue', function consumer() {
          var tx = shim.getSegment().transaction
          expect(tx.isActive()).to.be.true

          return new Promise(function(resolve) {
            expect(tx.isActive()).to.be.true
            setImmediate(resolve)
          }).then(function() {
            expect(tx.isActive()).to.be.true
            setTimeout(function() {
              expect(tx.isActive()).to.be.false
              done()
            }, 5)
          })
        })
      })

      it('should end the transaction when the handle says to', function(done) {
        var api = new API(agent)

        wrapped('my.queue', function consumer() {
          var tx = shim.getSegment().transaction
          var handle = api.getTransaction()

          expect(tx.isActive()).to.be.true
          setTimeout(function() {
            expect(tx.isActive()).to.be.true
            handle.end()
            setTimeout(function() {
              expect(tx.isActive()).to.be.false
              done()
            }, 5)
          }, 5)
        })
      })

      it('should call spec.messageHandler before consumer is invoked', function(done) {
        wrapped('my.queue', function consumer() {
          expect(handlerCalled).to.be.true
          done()
        })
        expect(handlerCalled).to.be.false
      })

      it('should add agent attributes (e.g. routing key)', function(done) {
        wrapped('my.queue', function consumer() {
          const segment = shim.getSegment()
          const tx = segment.transaction
          const traceParams = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)

          expect(traceParams).to.have.property('message.routingKey', 'routing.key')
          expect(traceParams).to.have.property('message.queueName', 'my.queue')
          done()
        })
      })

      it('should add agent attributes (e.g. routing key) to Spans', function(done) {
        wrapped('my.queue', function consumer() {
          const segment = shim.getSegment()
          const spanParams = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          expect(spanParams).to.have.property('message.routingKey', 'routing.key')
          expect(spanParams).to.have.property('message.queueName', 'my.queue')
          done()
        })
      })

      it('should add message.paremeters.* attributes to Spans', function(done) {
        wrapped('my.queue', function consumer() {
          const segment = shim.getSegment()
          const spanParams = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          expect(spanParams).to.have.property('message.parameters.a', 'a')
          expect(spanParams).to.have.property('message.parameters.b', 'b')
          done()
        })
      })

      it('should create message transaction metrics', function(done) {
        var metricNames = [
          'OtherTransaction/Message/RabbitMQ/Exchange/Named/exchange.foo',
          'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Named/exchange.foo',
          'OtherTransaction/Message/all',
          'OtherTransaction/all',
          'OtherTransactionTotalTime'
        ]

        wrapped('my.queue', function consumer() {
          setTimeout(function() {
            var metrics = getMetrics(agent)
            metricNames.forEach(function(name) {
              expect(metrics.unscoped).property(name).to.have.property('callCount', 1)
            })
            done()
          }, 15) // Let tx end from instrumentation
        })
      })

      it('should be able to get destinationName from arguments', function(done) {
        var metricNames = [
          'OtherTransaction/Message/RabbitMQ/Exchange/Named/my.exchange',
          'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Named/my.exchange',
        ]

        var func = shim.recordSubscribedConsume(subscriber, {
          name: 'Channel#subscribe',
          destinationName: shim.FIRST,
          destinationType: shim.EXCHANGE,
          consumer: shim.SECOND,
          callback: shim.LAST,
          messageHandler: function() { return {} }
        })

        func('my.exchange', function consumer() {
          setTimeout(function() {
            var metrics = getMetrics(agent)
            metricNames.forEach(function(name) {
              expect(metrics.unscoped).property(name).to.have.property('callCount', 1)
            })
            done()
          }, 15) // Let tx end from instrumentation
        })
      })

      it('should handle a missing destination name as temp', function(done) {
        var metricNames = [
          'OtherTransaction/Message/RabbitMQ/Exchange/Temp',
          'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Temp',
        ]

        messageHandler = function() {
          return {
            destinationName: null,
            destinationType: shim.EXCHANGE
          }
        }

        wrapped('my.queue', function consumer() {
          setTimeout(function() {
            var metrics = getMetrics(agent)
            metricNames.forEach(function(name) {
              expect(metrics.unscoped).property(name).to.have.property('callCount', 1)
            })
            done()
          }, 15) // Let tx end from instrumentation
        })
      })

      it('should extract CAT headers from the message', function(done) {
        var params = {
          encoding_key: 'this is an encoding key',
          cross_process_id: '1234#4321'
        }
        agent.config.trusted_account_ids = [9876, 6789]
        agent.config._fromServer(params, 'encoding_key')
        agent.config._fromServer(params, 'cross_process_id')

        var idHeader = hashes.obfuscateNameUsingKey('9876#id', agent.config.encoding_key)
        var txHeader = JSON.stringify(['trans id', false, 'trip id', 'path hash'])
        txHeader = hashes.obfuscateNameUsingKey(txHeader, agent.config.encoding_key)

        messageHandler = function() {
          var catHeaders = {
            NewRelicID: idHeader,
            NewRelicTransaction: txHeader
          }

          return {
            destinationName: 'foo',
            destingationType: shim.EXCHANGE,
            headers: catHeaders
          }
        }

        wrapped('my.queue', function consumer() {
          var tx = shim.getSegment().transaction

          expect(tx).to.have.property('incomingCatId', '9876#id')
          expect(tx).to.have.property('referringTransactionGuid', 'trans id')
          expect(tx).to.have.property('tripId', 'trip id')
          expect(tx).to.have.property('referringPathHash', 'path hash')
          expect(tx).to.have.property('invalidIncomingExternalTransaction', false)

          done()
        })
      })

      it('should invoke the consumer with the correct arguments', function(done) {
        wrapped('my.queue', function consumer(msg) {
          expect(msg).to.equal(message)
          done()
        })
      })

      describe('when invoked in a transaction', function() {
        it('should create a subscribe segment', function() {
          helper.runInTransaction(agent, function() {
            expect(subscriberCalled).to.be.false
            var segment = wrapped('my.queue')
            expect(subscriberCalled).to.be.true
            expect(segment).to.have.property('name', 'Channel#subscribe')
          })
        })

        it('should bind the subscribe callback', function(done) {
          helper.runInTransaction(agent, function() {
            var parent = wrapped('my.queue', null, function subCb() {
              var segment = shim.getSegment()
              expect(segment).to.have.property('name', 'Callback: subCb')
              expect(parent).property('children')
                .to.deep.equal([segment])
              done()
            })
            expect(parent).to.exist
          })
        })

        it('should still start a new transaction in the consumer', function(done) {
          helper.runInTransaction(agent, function() {
            var parent = wrapped('my.queue', function consumer() {
              var segment = shim.getSegment()
              expect(segment).property('name')
                .to.not.equal('Callback: consumer')
              expect(segment).property('transaction').property('id')
                .to.not.equal(parent.transaction.id)
              done()
            })
            expect(parent).to.exist
          })
        })
      })
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

function getMetrics(agent) {
  return agent.metrics._metrics
}
