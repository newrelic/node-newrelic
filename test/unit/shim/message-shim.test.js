/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const API = require('../../../api')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const hashes = require('../../../lib/util/hashes')
const helper = require('../../lib/agent_helper')
const MessageShim = require('../../../lib/shim/message-shim')
const { MessageSpec, MessageSubscribeSpec } = require('../../../lib/shim/specs')
const {
  compareSegments,
  checkWrappedCb,
  isNonWritable,
  match
} = require('../../lib/custom-assertions')

test('MessageShim', async function (t) {
  function beforeEach(ctx) {
    ctx.nr = {}
    const agent = helper.instrumentMockedAgent({
      span_events: {
        attributes: { enabled: true, include: ['message.parameters.*'] }
      }
    })
    const shim = new MessageShim(agent, 'test-module')
    shim.setLibrary(shim.RABBITMQ)
    ctx.nr.wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() {
        return 'fiz'
      },
      anony: function () {},
      getActiveSegment: function () {
        return agent.tracer.getSegment()
      },
      sendMessages: function () {},
      withNested: function () {
        const transaction = agent.tracer.getTransaction()
        const segment = agent.tracer.getSegment()
        transaction.trace.add('ChildSegment', null, segment)
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
    ctx.nr.agent = agent
    ctx.nr.shim = shim
  }

  function afterEach(ctx) {
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('constructor', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should require an agent parameter', function () {
      assert.throws(function () {
        return new MessageShim()
      }, 'Shim must be initialized with agent and module name')
    })

    await t.test('should require a module name parameter', function (t) {
      const { agent } = t.nr
      assert.throws(function () {
        return new MessageShim(agent)
      }, 'Error: Shim must be initialized with agent and module name')
    })

    await t.test('should assign properties from parent', (t) => {
      const { agent } = t.nr
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new MessageShim(agent, mod, mod, name, version)
      assert.equal(shim.moduleName, mod)
      assert.equal(agent, shim._agent)
      assert.equal(shim.pkgVersion, version)
    })
  })

  await t.test('well-known libraries/destination types', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    const messageLibs = ['RABBITMQ', 'EXCHANGE', 'QUEUE', 'TOPIC']

    for (const lib of messageLibs) {
      await t.test(`should be enumerated on the class and prototype of ${lib}`, function (t) {
        const { shim } = t.nr
        isNonWritable({ obj: MessageShim, key: lib })
        isNonWritable({ obj: shim, key: lib })
      })
    }
  })

  await t.test('#setLibrary', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should create broker metric names', function (t) {
      const { agent } = t.nr
      const s = new MessageShim(agent, 'test')
      assert.ok(!s._metrics)
      s.setLibrary('foobar')
      assert.equal(s._metrics.PREFIX, 'MessageBroker/')
      assert.equal(s._metrics.LIBRARY, 'foobar')
    })

    await t.test("should update the shim's logger", function (t) {
      const { agent } = t.nr
      const s = new MessageShim(agent, 'test')
      const { logger } = s
      s.setLibrary('foobar')
      assert.notEqual(s.logger, logger)
    })
  })

  await t.test('#recordProduce', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordProduce(wrappable, function () {})
      assert.equal(wrapped, wrappable)
      assert.ok(!shim.isWrapped(wrapped))
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordProduce(wrappable.bar, function () {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(helper.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordProduce(wrappable.bar, null, function () {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(helper.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordProduce(wrappable, 'bar', function () {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(helper.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordProduce(wrappable, 'name', function () {})
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should create a produce segment', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return new MessageSpec({ destinationName: 'foobar' })
      })

      helper.runInTransaction(agent, function () {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment()
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')
        assert.equal(agent.tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test('should add parameters to segment', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return new MessageSpec({
          routingKey: 'foo.bar',
          parameters: { a: 'a', b: 'b' }
        })
      })

      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment()
        const attributes = segment.getAttributes()
        assert.equal(attributes.routing_key, 'foo.bar')
        assert.equal(attributes.a, 'a')
        assert.equal(attributes.b, 'b')
        end()
      })
    })

    await t.test('should not add parameters when disabled', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      agent.config.message_tracer.segment_parameters.enabled = false
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return new MessageSpec({
          parameters: {
            a: 'a',
            b: 'b'
          }
        })
      })

      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment()
        const attributes = segment.getAttributes()
        assert.ok(!attributes.a)
        assert.ok(!attributes.b)
        end()
      })
    })

    await t.test('should execute the wrapped function', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordProduce(toWrap, function () {})

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
        shim.recordProduce(wrappable, 'bar', function (_, fn, name, args) {
          executed = true
          assert.equal(fn, original)
          assert.equal(name, 'bar')
          assert.equal(this, wrappable)
          assert.deepEqual(args, ['a', 'b', 'c'])

          return new MessageSpec({ destinationName: 'foobar' })
        })

        helper.runInTransaction(agent, function () {
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

      const wrapped = shim.recordProduce(toWrap, function () {
        return new MessageSpec({ callback: shim.LAST })
      })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })

    await t.test('should link the promise if one is returned', async function (t) {
      const { agent, shim } = t.nr
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
        return new MessageSpec({ promise: true })
      })

      return helper.runInTransaction(agent, function () {
        return wrapped().then(function (v) {
          assert.equal(v, val)
          const duration = segment.getDurationInMillis()
          assert.ok(
            duration > DELAY - 1,
            `Segment duration: ${duration} should be > Timer duration: ${DELAY - 1}`
          )
        })
      })
    })

    await t.test('should create a child segment when `opaque` is false', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordProduce(wrappable, 'withNested', function () {
        return new MessageSpec({ destinationName: 'foobar', opaque: false })
      })

      helper.runInTransaction(agent, (tx) => {
        const segment = wrappable.withNested()
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')

        const children = tx.trace.getChildren(segment.id)
        assert.equal(children.length, 1)
        const [childSegment] = children
        assert.equal(childSegment.name, 'ChildSegment')
        end()
      })
    })

    await t.test('should not create a child segment when `opaque` is true', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordProduce(wrappable, 'withNested', function () {
        return new MessageSpec({ destinationName: 'foobar', opaque: true })
      })

      helper.runInTransaction(agent, (tx) => {
        const segment = wrappable.withNested()
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Produce/Named/foobar')

        const children = tx.trace.getChildren(segment.id)
        assert.equal(children.length, 0)
        end()
      })
    })

    await t.test('should insert CAT request headers', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      agent.config.cross_application_tracer.enabled = true
      agent.config.distributed_tracing.enabled = false
      const headers = {}
      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return new MessageSpec({ headers })
      })

      helper.runInTransaction(agent, function () {
        wrappable.getActiveSegment()
        assert.ok(headers.NewRelicID)
        assert.ok(headers.NewRelicTransaction)
        end()
      })
    })

    await t.test('should insert distributed trace headers in all messages', async function (t) {
      const plan = tspl(t, { plan: 1 })
      const { agent, shim, wrappable } = t.nr
      const messages = [{}, { headers: { foo: 'foo' } }, {}]

      shim.recordProduce(
        wrappable,
        'sendMessages',
        () =>
          new MessageSpec({
            messageHeaders(inject) {
              for (const msg of messages) {
                if (msg.headers) {
                  inject(msg.headers)
                  continue
                }
                msg.headers = {}
                inject(msg.headers)
              }
            }
          })
      )

      let called = 0
      agent.on('transactionFinished', () => {
        called++
        match(messages, [
          {
            headers: {
              newrelic: '',
              traceparent: /^00-/
            }
          },
          {
            headers: {
              newrelic: '',
              traceparent: /^00-/,
              foo: 'foo'
            }
          },
          {
            headers: {
              newrelic: '',
              traceparent: /^00-/
            }
          }
        ])
        plan.equal(called, 1)
      })

      helper.runInTransaction(agent, (tx) => {
        wrappable.sendMessages()
        tx.end()
      })
      await plan.completed
    })

    await t.test('should create message broker metrics', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      let transaction = null

      shim.recordProduce(wrappable, 'getActiveSegment', function () {
        return new MessageSpec({ destinationName: 'my-queue' })
      })

      helper.runInTransaction(agent, function (tx) {
        transaction = tx
        wrappable.getActiveSegment()
        tx.end()
        const { unscoped } = helper.getMetrics(agent)
        const scoped = transaction.metrics.unscoped
        assert.ok(unscoped['MessageBroker/RabbitMQ/Exchange/Produce/Named/my-queue'])
        assert.ok(scoped['MessageBroker/RabbitMQ/Exchange/Produce/Named/my-queue'])
        end()
      })
    })
  })

  await t.test('#recordConsume', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordConsume(wrappable, function () {})
      assert.equal(wrapped, wrappable)
      assert.ok(!shim.isWrapped(wrapped))
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordConsume(wrappable.bar, function () {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordConsume(wrappable.bar, null, function () {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordConsume(wrappable, 'bar', function () {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordConsume(wrappable, 'name', function () {})
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should create a consume segment', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordConsume(wrappable, 'getActiveSegment', function () {
        assert.deepEqual(this, wrappable, 'make sure this is in tact')
        return new MessageSpec({ destinationName: 'foobar' })
      })

      helper.runInTransaction(agent, function () {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment()
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')
        assert.equal(agent.tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test('should bind the callback if there is one', function (t, end) {
      const { agent, shim } = t.nr
      const wrapped = shim.recordConsume(checkWrappedCb.bind(t, shim, end), function () {
        return new MessageSpec({ callback: shim.LAST })
      })

      helper.runInTransaction(agent, function () {
        wrapped(end)
      })
    })

    await t.test('should be able to get destinationName from arguments', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordConsume(wrappable, 'getActiveSegment', {
        destinationName: shim.FIRST,
        destinationType: shim.EXCHANGE
      })

      helper.runInTransaction(agent, function () {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment('fizzbang')
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/fizzbang')
        assert.equal(agent.tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test('should handle promise-based APIs', async function (t) {
      const { agent, shim } = t.nr
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
        after: function ({ result }) {
          assert.equal(result, msg)
        }
      })

      return helper.runInTransaction(agent, function () {
        return wrapped('foo', function () {}).then(function (message) {
          const duration = segment.getDurationInMillis()
          assert.ok(duration > DELAY - 1, 'segment duration should be at least 100 ms')
          assert.equal(message, msg)
        })
      })
    })

    await t.test('should bind promise even without messageHandler', async function (t) {
      const { agent, shim } = t.nr
      const msg = {}
      let segment = null
      const DELAY = 25

      const wrapped = shim.recordConsume(
        function wrapMe() {
          segment = shim.getSegment()
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(msg)
            }, DELAY)
          })
        },
        {
          destinationName: shim.FIRST,
          promise: true
        }
      )

      return helper.runInTransaction(agent, function () {
        return wrapped('foo', function () {}).then(function (message) {
          const duration = segment.getDurationInMillis()
          assert.ok(duration > DELAY - 1, 'segment duration should be at least 100 ms')
          assert.equal(message, msg)
        })
      })
    })

    await t.test('should execute the wrapped function', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordConsume(toWrap, function () {
        return new MessageSpec({ destinationName: 'foo' })
      })

      helper.runInTransaction(agent, function () {
        assert.equal(executed, false)
        wrapped()
        assert.equal(executed, true)
        end()
      })
    })

    await t.test('should create a child segment when `opaque` is false', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordConsume(wrappable, 'withNested', function () {
        return new MessageSpec({ destinationName: 'foobar', opaque: false })
      })

      helper.runInTransaction(agent, function (tx) {
        const segment = wrappable.withNested()
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')

        const children = tx.trace.getChildren(segment.id)
        assert.equal(children.length, 1)
        const [childSegment] = children
        assert.equal(childSegment.name, 'ChildSegment')
        end()
      })
    })

    await t.test('should not create a child segment when `opaque` is true', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordConsume(wrappable, 'withNested', function () {
        return new MessageSpec({ destinationName: 'foobar', opaque: true })
      })

      helper.runInTransaction(agent, function (tx) {
        const segment = wrappable.withNested()
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar')
        const children = tx.trace.getChildren(segment.id)
        assert.equal(children.length, 0)
        end()
      })
    })

    await t.test('should create message broker metrics', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordConsume(wrappable, 'getActiveSegment', function () {
        return new MessageSpec({ destinationName: 'foobar' })
      })

      helper.runInTransaction(agent, function (tx) {
        wrappable.getActiveSegment()
        tx.finalizeName('test-transaction')
        setImmediate(tx.end.bind(tx))
      })

      agent.on('transactionFinished', function () {
        const metrics = helper.getMetrics(agent)
        assert.ok(metrics.unscoped['MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar'])
        assert.ok(
          metrics.scoped['WebTransaction/test-transaction'][
            'MessageBroker/RabbitMQ/Exchange/Consume/Named/foobar'
          ]
        )
        end()
      })
    })
  })

  await t.test('#recordPurgeQueue', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordPurgeQueue(wrappable, {})
      assert.equal(wrapped, wrappable)
      assert.ok(!shim.isWrapped(wrapped))
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordPurgeQueue(wrappable.bar, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordPurgeQueue(wrappable.bar, null, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordPurgeQueue(wrappable, 'bar', {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordPurgeQueue(wrappable, 'name', {})
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should create a purge segment and metric', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordPurgeQueue(wrappable, 'getActiveSegment', new MessageSpec({ queue: shim.FIRST }))

      helper.runInTransaction(agent, function () {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment('foobar')
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'MessageBroker/RabbitMQ/Queue/Purge/Named/foobar')
        assert.equal(agent.tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test('should call the spec if it is not static', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      let called = false

      shim.recordPurgeQueue(wrappable, 'getActiveSegment', function () {
        called = true
        return new MessageSpec({ queue: shim.FIRST })
      })

      helper.runInTransaction(agent, function () {
        assert.equal(called, false)
        wrappable.getActiveSegment('foobar')
        assert.equal(called, true)
        end()
      })
    })

    await t.test('should execute the wrapped function', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordPurgeQueue(toWrap, {})

      helper.runInTransaction(agent, function () {
        assert.equal(executed, false)
        wrapped()
        assert.equal(executed, true)
        end()
      })
    })

    await t.test('should bind the callback if there is one', function (t, end) {
      const { agent, shim } = t.nr
      const wrapped = shim.recordPurgeQueue(
        checkWrappedCb.bind(null, shim, end),
        new MessageSpec({
          callback: shim.LAST
        })
      )

      helper.runInTransaction(agent, function () {
        wrapped(end)
      })
    })

    await t.test('should link the promise if one is returned', async function (t) {
      const { agent, shim } = t.nr
      const DELAY = 25
      const val = {}
      let segment = null

      const wrapped = shim.recordPurgeQueue(function () {
        segment = shim.getSegment()
        return new Promise(function (res) {
          setTimeout(res, DELAY, val)
        })
      }, new MessageSpec({ promise: true }))

      return helper.runInTransaction(agent, function () {
        return wrapped().then(function (v) {
          assert.equal(v, val)
          const duration = segment.getDurationInMillis()
          assert.ok(
            duration > DELAY - 1,
            `Segment duration: ${duration} should be > Timer duration: ${DELAY - 1}`
          )
        })
      })
    })

    await t.test('should create message broker metrics', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      let transaction = null
      shim.recordPurgeQueue(wrappable, 'getActiveSegment', new MessageSpec({ queue: shim.FIRST }))

      helper.runInTransaction(agent, function (tx) {
        transaction = tx
        wrappable.getActiveSegment('my-queue')
        tx.end()
        const { unscoped } = helper.getMetrics(agent)
        const scoped = transaction.metrics.unscoped
        assert.ok(unscoped['MessageBroker/RabbitMQ/Queue/Purge/Named/my-queue'])
        assert.ok(scoped['MessageBroker/RabbitMQ/Queue/Purge/Named/my-queue'])
        end()
      })
    })
  })

  await t.test('#recordSubscribedConsume', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordSubscribedConsume(wrappable, {
        consumer: shim.FIRST,
        messageHandler: function () {}
      })
      assert.equal(wrapped, wrappable)
      assert.ok(!shim.isWrapped(wrapped))
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordSubscribedConsume(wrappable.bar, {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(helper.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordSubscribedConsume(wrappable.bar, null, {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(helper.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordSubscribedConsume(wrappable, 'bar', {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(helper.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordSubscribedConsume(wrappable, 'name', {
        consumer: shim.FIRST,
        messageHandler: function () {},
        wrapper: function () {}
      })
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should allow spec to be a function', function (t, end) {
      const { shim, wrappable } = t.nr
      shim.recordSubscribedConsume(wrappable, 'name', function () {
        assert.deepEqual(this, wrappable, 'should preserve this context')
        return {
          consumer: shim.FIRST,
          messageHandler: function () {},
          wrapper: function () {}
        }
      })
      assert.equal(shim.isWrapped(wrappable.name), false)
      end()
    })
  })

  await t.test('#recordSubscribedConsume wrapper', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { shim } = ctx.nr

      ctx.nr.message = {}
      ctx.nr.handlerCalled = false
      ctx.nr.subscriberCalled = false
      const subscriber = function consumeSubscriber(queue, consumer, cb) {
        ctx.nr.subscriberCalled = true
        if (cb) {
          setImmediate(cb)
        }
        if (consumer) {
          setImmediate(consumer, ctx.nr.message)
        }
        return shim.getSegment()
      }

      ctx.nr.wrapped = shim.recordSubscribedConsume(subscriber, {
        name: 'Channel#subscribe',
        queue: shim.FIRST,
        consumer: shim.SECOND,
        callback: shim.LAST,
        messageHandler: function (shim) {
          ctx.nr.handlerCalled = true
          if (ctx.nr.messageHandler) {
            return ctx.nr.messageHandler.apply(this, arguments)
          }
          return new MessageSubscribeSpec({
            destinationName: 'exchange.foo',
            destinationType: shim.EXCHANGE,
            routingKey: 'routing.key',
            properties: {
              queue_name: 'amq.randomQueueName'
            },
            parameters: { a: 'a', b: 'b' }
          })
        }
      })
      ctx.nr.subscriber = subscriber
    })

    t.afterEach(afterEach)

    await t.test('should start a new transaction in the consumer', function (t, end) {
      const { shim, wrapped } = t.nr
      const parent = wrapped('my.queue', function consumer() {
        const segment = shim.getSegment()
        assert.notEqual(segment.name, 'Callback: consumer')
        const transaction = shim.tracer.getTransaction()
        assert.equal(transaction.type, 'message')
        end()
      })

      assert.ok(!parent)
    })

    await t.test('should end the transaction immediately if not handled', function (t, end) {
      const { shim, wrapped } = t.nr
      wrapped('my.queue', function consumer() {
        const tx = shim.tracer.getTransaction()
        assert.equal(tx.isActive(), true)
        setTimeout(function () {
          assert.equal(tx.isActive(), false)
          end()
        }, 5)
      })
    })

    await t.test('should end the transaction based on a promise', function (t, end) {
      const { shim, wrapped } = t.nr
      t.nr.messageHandler = function () {
        return new MessageSpec({ promise: true })
      }

      wrapped('my.queue', function consumer() {
        const tx = shim.tracer.getTransaction()
        assert.equal(tx.isActive(), true)

        return new Promise(function (resolve) {
          assert.equal(tx.isActive(), true)
          setImmediate(resolve)
        }).then(function () {
          assert.equal(tx.isActive(), true)
          setTimeout(function () {
            assert.equal(tx.isActive(), false)
            end()
          }, 5)
        })
      })
    })

    await t.test('should properly time promise based consumers', function (t, end) {
      const { shim, wrapped } = t.nr
      t.nr.messageHandler = function () {
        return new MessageSpec({ promise: true })
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
            assert.ok(duration > DELAY - 1, 'promised based consumers should be timed properly')
            end()
          })
        })
      })
    })

    await t.test('should end the transaction when the handle says to', function (t, end) {
      const { agent, shim, wrapped } = t.nr
      const api = new API(agent)

      wrapped('my.queue', function consumer() {
        const tx = shim.tracer.getTransaction()
        const handle = api.getTransaction()

        assert.equal(tx.isActive(), true)
        setTimeout(function () {
          assert.equal(tx.isActive(), true)
          handle.end()
          setTimeout(function () {
            assert.equal(tx.isActive(), false)
            end()
          }, 5)
        }, 5)
      })
    })

    await t.test('should call spec.messageHandler before consumer is invoked', function (t, end) {
      const { wrapped } = t.nr
      wrapped('my.queue', function consumer() {
        assert.equal(t.nr.handlerCalled, true)
        end()
      })

      assert.equal(t.nr.handlerCalled, false)
    })

    await t.test('should add agent attributes (e.g. routing key)', function (t, end) {
      const { shim, wrapped } = t.nr
      wrapped('my.queue', function consumer() {
        const tx = shim.tracer.getTransaction()
        const traceParams = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)

        assert.equal(traceParams['message.routingKey'], 'routing.key')
        assert.equal(traceParams['message.queueName'], 'my.queue')
        end()
      })
    })

    await t.test('should add agent attributes (e.g. routing key) to Spans', function (t, end) {
      const { shim, wrapped } = t.nr
      wrapped('my.queue', function consumer() {
        const segment = shim.getSegment()
        const spanParams = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        assert.equal(spanParams['message.routingKey'], 'routing.key')
        assert.equal(spanParams['message.queueName'], 'my.queue')
        end()
      })
    })

    await t.test('should add message.parameters.* attributes to Spans', function (t, end) {
      const { shim, wrapped } = t.nr
      wrapped('my.queue', function consumer() {
        const segment = shim.getSegment()
        const spanParams = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        assert.equal(spanParams['message.parameters.a'], 'a')
        assert.equal(spanParams['message.parameters.b'], 'b')
        end()
      })
    })

    await t.test('should create message transaction metrics', function (t, end) {
      const { agent, wrapped } = t.nr
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
            assert.equal(metrics.unscoped[name].callCount, 1)
          })
          end()
        }, 15) // Let tx end from instrumentation
      })
    })

    await t.test('should be able to get destinationName from arguments', function (t, end) {
      const { agent, shim, subscriber } = t.nr
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
          return new MessageSpec({})
        }
      })

      func('my.exchange', function consumer() {
        setTimeout(function () {
          const metrics = helper.getMetrics(agent)
          metricNames.forEach(function (name) {
            assert.equal(metrics.unscoped[name].callCount, 1)
          })
          end()
        }, 15) // Let tx end from instrumentation
      })
    })

    await t.test('should handle a missing destination name as temp', function (t, end) {
      const { agent, shim, wrapped } = t.nr
      const metricNames = [
        'OtherTransaction/Message/RabbitMQ/Exchange/Temp',
        'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Temp'
      ]

      t.nr.messageHandler = function () {
        return new MessageSpec({
          destinationName: null,
          destinationType: shim.EXCHANGE
        })
      }

      wrapped('my.queue', function consumer() {
        setTimeout(function () {
          const metrics = helper.getMetrics(agent)
          metricNames.forEach(function (name) {
            assert.equal(metrics.unscoped[name].callCount, 1)
          })
          end()
        }, 15) // Let tx end from instrumentation
      })
    })

    await t.test('should extract CAT headers from the message', function (t, end) {
      const { agent, shim, wrapped } = t.nr
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

      t.nr.messageHandler = function () {
        const catHeaders = {
          NewRelicID: idHeader,
          NewRelicTransaction: txHeader
        }

        return new MessageSpec({
          destinationName: 'foo',
          destinationType: shim.EXCHANGE,
          headers: catHeaders
        })
      }

      wrapped('my.queue', function consumer() {
        const tx = shim.tracer.getTransaction()

        assert.equal(tx.incomingCatId, '9876#id')
        assert.equal(tx.referringTransactionGuid, 'trans id')
        assert.equal(tx.tripId, 'trip id')
        assert.equal(tx.referringPathHash, 'path hash')
        assert.equal(tx.invalidIncomingExternalTransaction, false)
        end()
      })
    })

    await t.test('should invoke the consumer with the correct arguments', function (t, end) {
      const { wrapped } = t.nr
      wrapped('my.queue', function consumer(msg) {
        assert.equal(msg, t.nr.message)
        end()
      })
    })

    await t.test('should create a subscribe segment', function (t, end) {
      const { agent, wrapped } = t.nr
      helper.runInTransaction(agent, function () {
        assert.equal(t.nr.subscriberCalled, false)
        const segment = wrapped('my.queue')
        assert.equal(t.nr.subscriberCalled, true)
        assert.equal(segment.name, 'Channel#subscribe')
        end()
      })
    })

    await t.test('should bind the subscribe callback', function (t, end) {
      const { agent, shim, wrapped } = t.nr
      helper.runInTransaction(agent, function (tx) {
        const { trace } = tx
        const parent = wrapped('my.queue', null, function subCb() {
          const segment = shim.getSegment()
          assert.equal(segment.name, 'Callback: subCb')
          compareSegments({ parent, segments: [segment], trace })
          end()
        })
        assert.ok(parent)
      })
    })

    await t.test('should still start a new transaction in the consumer', function (t, end) {
      const { agent, shim, wrapped } = t.nr
      helper.runInTransaction(agent, function (tx) {
        const parent = wrapped('my.queue', function consumer() {
          const childTx = shim.tracer.getTransaction()
          const segment = shim.getSegment()
          assert.notEqual(segment.name, 'Callback: consumer')
          assert.ok(childTx.id)
          assert.notEqual(tx.id, childTx.id)
          end()
        })
        assert.ok(parent)
      })
    })

    await t.test('should wrap object key of consumer', async function (t) {
      const plan = tspl(t, { plan: 4 })
      const { shim } = t.nr
      const message = { foo: 'bar' }
      const subscriber = function subscriber(consumer) {
        consumer.eachMessage(message)
      }
      const wrapped = shim.recordSubscribedConsume(subscriber, {
        name: 'Channel#subscribe',
        consumer: shim.FIRST,
        functions: ['eachMessage'],
        messageHandler: function (shim, args) {
          plan.deepEqual(args[0], message)
          return new MessageSpec({
            destinationName: 'exchange.foo',
            destinationType: shim.EXCHANGE
          })
        }
      })

      const handler = {
        eachMessage: function consumer(msg) {
          plan.deepEqual(this, handler)
          const segment = shim.getSegment()
          plan.equal(segment.name, 'OtherTransaction/Message/RabbitMQ/Exchange/Named/exchange.foo')
          plan.equal(msg, message)
        }
      }
      wrapped(handler)
      await plan.completed
    })
  })
})
