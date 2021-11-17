/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const API = require('../../../api')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const hashes = require('../../../lib/util/hashes')
const helper = require('../../lib/agent_helper')
const MessageShim = require('../../../lib/shim/message-shim')

tap.Test.prototype.addAssert('isNonWritable', 1, helper.isNonWritable)

tap.test('MessageShim', function (t) {
  t.autoend()
  let agent = null
  let shim = null
  let wrappable = null
  let interval = null
  const tasks = []

  t.before(function () {
    interval = setInterval(function () {
      if (tasks.length) {
        tasks.pop()()
      }
    }, 10)
  })

  t.teardown(function () {
    clearInterval(interval)
  })

  function beforeEach() {
    agent = helper.instrumentMockedAgent({
      span_events: {
        attributes: { enabled: true, include: ['message.parameters.*'] }
      }
    })
    shim = new MessageShim(agent, 'test-module')
    shim.setLibrary(shim.RABBITMQ)
    wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() {
        return 'fiz'
      },
      anony: function () {},
      getActiveSegment: function () {
        return agent.tracer.getSegment()
      },
      withNested: function () {
        const segment = agent.tracer.getSegment()
        segment.add('ChildSegment')

        return segment
      }
    }

    const params = {
      encoding_key: 'this is an encoding key',
      cross_process_id: '1234#4321'
    }
    agent.config.trusted_account_ids = [9876, 6789]
    agent.config._fromServer(params, 'encoding_key')
    agent.config._fromServer(params, 'cross_process_id')
  }

  function afterEach() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  }

  t.test('constructor', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should require an agent parameter', function (t) {
      t.throws(function () {
        return new MessageShim()
      }, /^Shim must be initialized with .*? agent/)
      t.end()
    })

    t.test('should require a module name parameter', function (t) {
      t.throws(function () {
        return new MessageShim(agent)
      }, /^Shim must be initialized with .*? module name/)
      t.end()
    })
  })

  t.test('well-known message libraries', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    const messageLibs = ['RABBITMQ']

    t.test('should be enumerated on the class and prototype', function (t) {
      messageLibs.forEach(function (lib) {
        t.isNonWritable({ obj: MessageShim, key: lib })
        t.isNonWritable({ obj: shim, key: lib })
      })
      t.end()
    })
  })

  t.test('well-known destination types', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    const messageLibs = ['EXCHANGE', 'QUEUE', 'TOPIC']

    t.test('should be enumerated on the class and prototype', function (t) {
      messageLibs.forEach(function (lib) {
        t.isNonWritable({ obj: MessageShim, key: lib })
        t.isNonWritable({ obj: shim, key: lib })
      })
      t.end()
    })
  })

  t.test('#setLibrary', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should create broker metric names', function (t) {
      const s = new MessageShim(agent, 'test')
      t.notOk(s._metrics)
      s.setLibrary('foobar')
      t.equal(s._metrics.PREFIX, 'MessageBroker/')
      t.equal(s._metrics.LIBRARY, 'foobar')
      t.end()
    })

    t.test("should update the shim's logger", function (t) {
      const s = new MessageShim(agent, 'test')
      const { logger } = s
      s.setLibrary('foobar')
      t.not(s.logger, logger)
      t.end()
    })
  })

  t.test('#recordProduce', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordProduce(wrappable, function () {})
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordProduce(wrappable.bar, function () {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordProduce(wrappable.bar, null, function () {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordProduce(wrappable, 'bar', function () {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordProduce(wrappable, 'name', function () {})
      t.not(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should create a produce segment', function (t) {
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return { destinationName: 'foobar' }
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment()
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should add parameters to segment', function (t) {
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return {
          routingKey: 'foo.bar',
          parameters: { a: 'a', b: 'b' }
        }
      })

      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment()
        const attributes = segment.getAttributes()
        t.equal(attributes.routing_key, 'foo.bar')
        t.equal(attributes.a, 'a')
        t.equal(attributes.b, 'b')
        t.end()
      })
    })

    t.test('should not add parameters when disabled', function (t) {
      agent.config.message_tracer.segment_parameters.enabled = false
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return {
          parameters: {
            a: 'a',
            b: 'b'
          }
        }
      })

      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment()
        const attributes = segment.getAttributes()
        t.notOk(attributes.a)
        t.notOk(attributes.b)
        t.end()
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordProduce(toWrap, function () {})

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
      shim.recordProduce(wrappable, 'bar', function (_, fn, name, args) {
        executed = true
        t.equal(fn, original)
        t.equal(name, 'bar')
        t.equal(this, wrappable)
        t.same(args, ['a', 'b', 'c'])

        return { destinationName: 'foobar' }
      })

      helper.runInTransaction(agent, function () {
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

      const wrapped = shim.recordProduce(toWrap, function () {
        return { callback: shim.LAST }
      })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })

    t.test('should link the promise if one is returned', function (t) {
      const DELAY = 25
      let segment = null
      const val = {}
      const toWrap = function () {
        segment = shim.getSegment()
        return new Promise(function (res) {
          setTimeout(res, DELAY, val)
        })
      }

      const wrapped = shim.recordProduce(toWrap, function () {
        return { promise: true }
      })

      return helper.runInTransaction(agent, function () {
        return wrapped().then(function (v) {
          t.equal(v, val)
          const duration = segment.getDurationInMillis()
          t.ok(
            duration > DELAY - 1,
            `Segment duration: ${duration} should be > Timer duration: ${DELAY - 1}`
          )
        })
      })
    })

    t.test('should create a child segment when `opaque` is false', function (t) {
      shim.recordProduce(wrappable, 'withNested', function () {
        return { destinationName: 'foobar', opaque: false }
      })

      helper.runInTransaction(agent, (tx) => {
        const segment = wrappable.withNested()
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')

        t.equal(segment.children.length, 1)
        const [childSegment] = segment.children
        t.equal(childSegment.name, 'ChildSegment')
        t.end()
      })
    })

    t.test('should not create a child segment when `opaque` is true', function (t) {
      shim.recordProduce(wrappable, 'withNested', function () {
        return { destinationName: 'foobar', opaque: true }
      })

      helper.runInTransaction(agent, (tx) => {
        const segment = wrappable.withNested()
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')

        t.equal(segment.children.length, 0)
        t.end()
      })
    })

    t.test('should insert CAT request headers', function (t) {
      agent.config.cross_application_tracer.enabled = true
      agent.config.distributed_tracing.enabled = false
      const headers = {}
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return { headers: headers }
      })

      helper.runInTransaction(agent, function () {
        wrappable.getActiveSegment()
        t.ok(headers.NewRelicID)
        t.ok(headers.NewRelicTransaction)
        t.end()
      })
    })

    t.test('should create message broker metrics', function (t) {
      let transaction = null

      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return { destinationName: 'my-queue' }
      })

      helper.runInTransaction(agent, function (tx) {
        transaction = tx
        wrappable.getActiveSegment()
        tx.end()
        const { unscoped } = helper.getMetrics(agent)
        const scoped = transaction.metrics.unscoped
        t.ok(unscoped['MessageBroker/RabbitMQ/Exchange/Produce/Named/my-queue'])
        t.ok(scoped['MessageBroker/RabbitMQ/Exchange/Produce/Named/my-queue'])
        t.end()
      })
    })
  })

  t.test('#recordConsume', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordConsume(wrappable, function () {})
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordConsume(wrappable.bar, function () {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordConsume(wrappable.bar, null, function () {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordConsume(wrappable, 'bar', function () {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordConsume(wrappable, 'name', function () {})
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should create a consume segment', function (t) {
      shim.recordConsume(wrappable, 'getActiveSegment', function () {
        return { destinationName: 'foobar' }
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment()
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')
        t.equal(agent.tracer.getSegment(), startingSegment)
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

      const wrapped = shim.recordConsume(toWrap, function () {
        return { callback: shim.LAST }
      })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })

    t.test('should add parameters to segment', function (t) {
      function wrapMe(q, cb) {
        cb()
        return shim.getSegment()
      }

      const wrapped = shim.recordConsume(wrapMe, {
        destinationName: shim.FIRST,
        callback: shim.LAST,
        messageHandler: function () {
          return { parameters: { a: 'a', b: 'b' } }
        }
      })

      helper.runInTransaction(agent, function () {
        const segment = wrapped('foo', function () {})
        const attributes = segment.getAttributes()
        t.equal(attributes.a, 'a')
        t.equal(attributes.b, 'b')
        t.end()
      })
    })

    t.test('should not add parameters when disabled', function (t) {
      agent.config.message_tracer.segment_parameters.enabled = false
      function wrapMe(q, cb) {
        cb()
        return shim.getSegment()
      }

      const wrapped = shim.recordConsume(wrapMe, {
        destinationName: shim.FIRST,
        callback: shim.LAST,
        messageHandler: function () {
          return { parameters: { a: 'a', b: 'b' } }
        }
      })

      helper.runInTransaction(agent, function () {
        const segment = wrapped('foo', function () {})
        const attributes = segment.getAttributes()
        t.notOk(attributes.a)
        t.notOk(attributes.b)
        t.end()
      })
    })

    t.test('should be able to get destinationName from arguments', function (t) {
      shim.recordConsume(wrappable, 'getActiveSegment', {
        destinationName: shim.FIRST,
        destinationType: shim.EXCHANGE
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment('fizzbang')
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/fizzbang')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should handle promise-based APIs', function (t) {
      const msg = {}
      let segment = null
      const DELAY = 25

      function wrapMe() {
        segment = shim.getSegment()
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(msg)
          }, DELAY)
        })
      }

      const wrapped = shim.recordConsume(wrapMe, {
        destinationName: shim.FIRST,
        promise: true,
        messageHandler: function (shim, fn, name, message) {
          t.equal(message, msg)
          return { parameters: { a: 'a', b: 'b' } }
        }
      })

      return helper.runInTransaction(agent, function () {
        return wrapped('foo', function () {}).then(function (message) {
          const duration = segment.getDurationInMillis()
          t.ok(duration > DELAY - 1, 'segment duration should be at least 100 ms')
          t.equal(message, msg)
          const attributes = segment.getAttributes()
          t.equal(attributes.a, 'a')
          t.equal(attributes.b, 'b')
        })
      })
    })

    t.test('should bind promise even without messageHandler', function (t) {
      const msg = {}
      let segment = null
      const DELAY = 25

      function wrapMe() {
        segment = shim.getSegment()
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(msg)
          }, DELAY)
        })
      }

      const wrapped = shim.recordConsume(wrapMe, {
        destinationName: shim.FIRST,
        promise: true
      })

      return helper.runInTransaction(agent, function () {
        return wrapped('foo', function () {}).then(function (message) {
          const duration = segment.getDurationInMillis()
          t.ok(duration > DELAY - 1, 'segment duration should be at least 100 ms')
          t.equal(message, msg)
        })
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordConsume(toWrap, function () {
        return { destinationName: 'foo' }
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
      shim.recordConsume(wrappable, 'bar', function (_, fn, name, args) {
        executed = true
        t.equal(fn, original)
        t.equal(name, 'bar')
        t.equal(this, wrappable)
        t.same(args, ['a', 'b', 'c'])

        return { destinationName: 'foobar' }
      })

      helper.runInTransaction(agent, function () {
        wrappable.bar('a', 'b', 'c')
        t.ok(executed)
        t.end()
      })
    })

    t.test('should create a child segment when `opaque` is false', function (t) {
      shim.recordConsume(wrappable, 'withNested', function () {
        return { destinationName: 'foobar', opaque: false }
      })

      helper.runInTransaction(agent, function (tx) {
        const segment = wrappable.withNested()
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')

        t.equal(segment.children.length, 1)
        const [childSegment] = segment.children
        t.equal(childSegment.name, 'ChildSegment')
        t.end()
      })
    })

    t.test('should not create a child segment when `opaque` is true', function (t) {
      shim.recordConsume(wrappable, 'withNested', function () {
        return { destinationName: 'foobar', opaque: true }
      })

      helper.runInTransaction(agent, function (tx) {
        const segment = wrappable.withNested()
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')
        t.equal(segment.children.length, 0)
        t.end()
      })
    })

    t.test('should create message broker metrics', function (t) {
      shim.recordConsume(wrappable, 'getActiveSegment', function () {
        return { destinationName: 'foobar' }
      })

      helper.runInTransaction(agent, function (tx) {
        wrappable.getActiveSegment()
        tx.finalizeName('test-transaction')
        setImmediate(tx.end.bind(tx))
      })

      agent.on('transactionFinished', function () {
        const metrics = helper.getMetrics(agent)
        t.ok(metrics.unscoped['MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar'])
        t.ok(
          metrics.scoped['WebTransaction/test-transaction'][
            'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar'
          ]
        )
        t.end()
      })
    })
  })

  t.test('#recordPurgeQueue', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordPurgeQueue(wrappable, {})
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordPurgeQueue(wrappable.bar, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordPurgeQueue(wrappable.bar, null, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordPurgeQueue(wrappable, 'bar', {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordPurgeQueue(wrappable, 'name', {})
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should create a purge segment and metric', function (t) {
      shim.recordPurgeQueue(wrappable, 'getActiveSegment', { queue: shim.FIRST })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment('foobar')
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'MessageBroker/RabbitMQ/Queue/Purge/Named/foobar')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should call the spec if it is not static', function (t) {
      let called = false

      shim.recordPurgeQueue(wrappable, 'getActiveSegment', function () {
        called = true
        return { queue: shim.FIRST }
      })

      helper.runInTransaction(agent, function () {
        t.notOk(called)
        wrappable.getActiveSegment('foobar')
        t.ok(called)
        t.end()
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordPurgeQueue(toWrap, {})

      helper.runInTransaction(agent, function () {
        t.notOk(executed)
        wrapped()
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

      const wrapped = shim.recordPurgeQueue(toWrap, { callback: shim.LAST })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })

    t.test('should link the promise if one is returned', function (t) {
      const DELAY = 25
      const val = {}
      let segment = null
      const toWrap = function () {
        segment = shim.getSegment()
        return new Promise(function (res) {
          setTimeout(res, DELAY, val)
        })
      }

      const wrapped = shim.recordPurgeQueue(toWrap, { promise: true })

      return helper.runInTransaction(agent, function () {
        return wrapped().then(function (v) {
          t.equal(v, val)
          const duration = segment.getDurationInMillis()
          t.ok(
            duration > DELAY - 1,
            `Segment duration: ${duration} should be > Timer duration: ${DELAY - 1}`
          )
        })
      })
    })

    t.test('should create message broker metrics', function (t) {
      let transaction = null
      shim.recordPurgeQueue(wrappable, 'getActiveSegment', { queue: shim.FIRST })

      helper.runInTransaction(agent, function (tx) {
        transaction = tx
        wrappable.getActiveSegment('my-queue')
        tx.end()
        const { unscoped } = helper.getMetrics(agent)
        const scoped = transaction.metrics.unscoped
        t.ok(unscoped['MessageBroker/RabbitMQ/Queue/Purge/Named/my-queue'])
        t.ok(scoped['MessageBroker/RabbitMQ/Queue/Purge/Named/my-queue'])
        t.end()
      })
    })
  })

  t.test('#recordSubscribedConsume', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordSubscribedConsume(wrappable, {
        consumer: shim.FIRST,
        messageHandler: function () {}
      })
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordSubscribedConsume(wrappable.bar, {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordSubscribedConsume(wrappable.bar, null, {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordSubscribedConsume(wrappable, 'bar', {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordSubscribedConsume(wrappable, 'name', {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      t.not(shim.isWrapped(wrappable.name))
      t.end()
    })
  })

  t.test('#recordSubscribedConsume wrapper', function (t) {
    let message = null
    let messageHandler = null
    let subscriber = null
    let wrapped = null
    let handlerCalled = false
    let subscriberCalled = false

    t.autoend()

    t.beforeEach(function () {
      beforeEach()

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
        messageHandler: function (shim) {
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
            parameters: { a: 'a', b: 'b' }
          }
        }
      })
    })

    t.afterEach(function () {
      afterEach()
      message = null
      subscriber = null
      wrapped = null
      messageHandler = null
      subscriberCalled = false
      handlerCalled = false
    })

    t.test('should start a new transaction in the consumer', function (t) {
      const parent = wrapped('my.queue', function consumer() {
        const segment = shim.getSegment()
        t.not(segment.name, 'Callback: consumer')
        t.equal(segment.transaction.type, 'message')
        t.end()
      })

      t.notOk(parent)
    })

    t.test('should end the transaction immediately if not handled', function (t) {
      wrapped('my.queue', function consumer() {
        const tx = shim.getSegment().transaction
        t.ok(tx.isActive())
        setTimeout(function () {
          t.notOk(tx.isActive())
          t.end()
        }, 5)
      })
    })

    t.test('should end the transaction based on a promise', function (t) {
      messageHandler = function () {
        return { promise: true }
      }

      wrapped('my.queue', function consumer() {
        const tx = shim.getSegment().transaction
        t.ok(tx.isActive())

        return new Promise(function (resolve) {
          t.ok(tx.isActive())
          setImmediate(resolve)
        }).then(function () {
          t.ok(tx.isActive())
          setTimeout(function () {
            t.notOk(tx.isActive())
            t.end()
          }, 5)
        })
      })
    })

    t.test('should properly time promise based consumers', function (t) {
      messageHandler = function () {
        return { promise: true }
      }

      let segment
      const DELAY = 25
      wrapped('my.queue', function consumer() {
        return new Promise((resolve) => {
          segment = shim.getSegment()
          setTimeout(resolve, DELAY)
        }).then(function () {
          setImmediate(() => {
            const duration = segment.getDurationInMillis()
            t.ok(duration > DELAY - 1, 'promised based consumers should be timed properly')
            t.end()
          })
        })
      })
    })

    t.test('should end the transaction when the handle says to', function (t) {
      const api = new API(agent)

      wrapped('my.queue', function consumer() {
        const tx = shim.getSegment().transaction
        const handle = api.getTransaction()

        t.ok(tx.isActive())
        setTimeout(function () {
          t.ok(tx.isActive())
          handle.end()
          setTimeout(function () {
            t.notOk(tx.isActive())
            t.end()
          }, 5)
        }, 5)
      })
    })

    t.test('should call spec.messageHandler before consumer is invoked', function (t) {
      wrapped('my.queue', function consumer() {
        t.ok(handlerCalled)
        t.end()
      })

      t.notOk(handlerCalled)
    })

    t.test('should add agent attributes (e.g. routing key)', function (t) {
      wrapped('my.queue', function consumer() {
        const segment = shim.getSegment()
        const tx = segment.transaction
        const traceParams = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)

        t.equal(traceParams['message.routingKey'], 'routing.key')
        t.equal(traceParams['message.queueName'], 'my.queue')
        t.end()
      })
    })

    t.test('should add agent attributes (e.g. routing key) to Spans', function (t) {
      wrapped('my.queue', function consumer() {
        const segment = shim.getSegment()
        const spanParams = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        t.equal(spanParams['message.routingKey'], 'routing.key')
        t.equal(spanParams['message.queueName'], 'my.queue')
        t.end()
      })
    })

    t.test('should add message.paremeters.* attributes to Spans', function (t) {
      wrapped('my.queue', function consumer() {
        const segment = shim.getSegment()
        const spanParams = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        t.equal(spanParams['message.parameters.a'], 'a')
        t.equal(spanParams['message.parameters.b'], 'b')
        t.end()
      })
    })

    t.test('should create message transaction metrics', function (t) {
      const metricNames = [
        'OtherTransaction/Message/RabbitMQ/Exchange/Named/exchange.foo',
        'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Named/exchange.foo',
        'OtherTransaction/Message/all',
        'OtherTransaction/all',
        'OtherTransactionTotalTime'
      ]

      wrapped('my.queue', function consumer() {
        setTimeout(function () {
          const metrics = helper.getMetrics(agent)
          metricNames.forEach(function (name) {
            t.equal(metrics.unscoped[name].callCount, 1)
          })
          t.end()
        }, 15) // Let tx end from instrumentation
      })
    })

    t.test('should be able to get destinationName from arguments', function (t) {
      const metricNames = [
        'OtherTransaction/Message/RabbitMQ/Exchange/Named/my.exchange',
        'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Named/my.exchange'
      ]

      const func = shim.recordSubscribedConsume(subscriber, {
        name: 'Channel#subscribe',
        destinationName: shim.FIRST,
        destinationType: shim.EXCHANGE,
        consumer: shim.SECOND,
        callback: shim.LAST,
        messageHandler: function () {
          return {}
        }
      })

      func('my.exchange', function consumer() {
        setTimeout(function () {
          const metrics = helper.getMetrics(agent)
          metricNames.forEach(function (name) {
            t.equal(metrics.unscoped[name].callCount, 1)
          })
          t.end()
        }, 15) // Let tx end from instrumentation
      })
    })

    t.test('should handle a missing destination name as temp', function (t) {
      const metricNames = [
        'OtherTransaction/Message/RabbitMQ/Exchange/Temp',
        'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Temp'
      ]

      messageHandler = function () {
        return {
          destinationName: null,
          destinationType: shim.EXCHANGE
        }
      }

      wrapped('my.queue', function consumer() {
        setTimeout(function () {
          const metrics = helper.getMetrics(agent)
          metricNames.forEach(function (name) {
            t.equal(metrics.unscoped[name].callCount, 1)
          })
          t.end()
        }, 15) // Let tx end from instrumentation
      })
    })

    t.test('should extract CAT headers from the message', function (t) {
      agent.config.cross_application_tracer.enabled = true
      agent.config.distributed_tracing.enabled = false
      const params = {
        encoding_key: 'this is an encoding key',
        cross_process_id: '1234#4321'
      }
      agent.config.trusted_account_ids = [9876, 6789]
      agent.config._fromServer(params, 'encoding_key')
      agent.config._fromServer(params, 'cross_process_id')

      const idHeader = hashes.obfuscateNameUsingKey('9876#id', agent.config.encoding_key)
      let txHeader = JSON.stringify(['trans id', false, 'trip id', 'path hash'])
      txHeader = hashes.obfuscateNameUsingKey(txHeader, agent.config.encoding_key)

      messageHandler = function () {
        const catHeaders = {
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
        const tx = shim.getSegment().transaction

        t.equal(tx.incomingCatId, '9876#id')
        t.equal(tx.referringTransactionGuid, 'trans id')
        t.equal(tx.tripId, 'trip id')
        t.equal(tx.referringPathHash, 'path hash')
        t.equal(tx.invalidIncomingExternalTransaction, false)
        t.end()
      })
    })

    t.test('should invoke the consumer with the correct arguments', function (t) {
      wrapped('my.queue', function consumer(msg) {
        t.equal(msg, message)
        t.end()
      })
    })

    t.test('should create a subscribe segment', function (t) {
      helper.runInTransaction(agent, function () {
        t.notOk(subscriberCalled)
        const segment = wrapped('my.queue')
        t.ok(subscriberCalled)
        t.equal(segment.name, 'Channel#subscribe')
        t.end()
      })
    })

    t.test('should bind the subscribe callback', function (t) {
      helper.runInTransaction(agent, function () {
        const parent = wrapped('my.queue', null, function subCb() {
          const segment = shim.getSegment()
          t.equal(segment.name, 'Callback: subCb')
          t.same(parent.children, [segment])
          t.end()
        })
        t.ok(parent)
      })
    })

    t.test('should still start a new transaction in the consumer', function (t) {
      helper.runInTransaction(agent, function () {
        const parent = wrapped('my.queue', function consumer() {
          const segment = shim.getSegment()
          t.not(segment.name, 'Callback: consumer')
          t.ok(segment.transaction.id)
          t.not(segment.transaction.id, parent.transaction.id)
          t.end()
        })
        t.ok(parent)
      })
    })
  })
})
