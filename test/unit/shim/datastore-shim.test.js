/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const getMetricHostName = require('../../lib/metrics_helper').getMetricHostName
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const ParsedStatement = require('../../../lib/db/parsed-statement')
const { QuerySpec, OperationSpec } = require('../../../lib/shim/specs')
const { checkWrappedCb } = require('../../lib/custom-assertions')

test('DatastoreShim', async function (t) {
  function beforeEach(ctx) {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    const shim = new DatastoreShim(agent, 'test-cassandra')
    shim.setDatastore(DatastoreShim.CASSANDRA)
    ctx.nr.wrappable = {
      name: 'this is a name',
      bar: function barsName() {
        return 'bar'
      },
      fiz: function fizsName() {
        return 'fiz'
      },
      anony: function () {},
      getActiveSegment: function getActiveSegment() {
        return agent.tracer.getSegment()
      },
      withNested: function () {
        const tx = agent.tracer.getTransaction()
        const segment = agent.tracer.getSegment()
        tx.trace.add('ChildSegment', null, segment)
        return segment
      }
    }
    ctx.nr.agent = agent
    ctx.nr.shim = shim
  }

  function afterEach(ctx) {
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('constructor', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should inherit from Shim', function (t) {
      const { shim } = t.nr
      assert.ok(shim instanceof DatastoreShim)
      assert.ok(shim instanceof Shim)
    })

    await t.test('should require the `agent` parameter', function () {
      assert.throws(
        () => new DatastoreShim(),
        'Error: Shim must be initialized with an agent and module name.'
      )
    })

    await t.test('should require the `moduleName` parameter', function (t) {
      const { agent } = t.nr
      assert.throws(
        () => new DatastoreShim(agent),
        'Error: Shim must be initialized with an agent and module name.'
      )
    })

    await t.test('should take an optional `datastore`', function (t) {
      const { agent, shim } = t.nr
      // Test without datastore
      let _shim = null
      assert.doesNotThrow(function () {
        _shim = new DatastoreShim(agent, 'test-cassandra')
      })
      assert.ok(!_shim._metrics)

      // Use one provided for all tests to check constructed with datastore
      assert.ok(shim._metrics)
    })

    await t.test('should assign properties from parent', (t) => {
      const { agent } = t.nr
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new DatastoreShim(agent, mod, mod, name, version)
      assert.equal(shim.moduleName, mod)
      assert.equal(agent, shim._agent)
      assert.equal(shim.pkgVersion, version)
    })
  })

  await t.test('well-known datastores', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    const datastores = [
      'CASSANDRA',
      'DYNAMODB',
      'MEMCACHED',
      'MONGODB',
      'MYSQL',
      'NEPTUNE',
      'REDIS',
      'POSTGRES'
    ]
    for (const ds of datastores) {
      await t.test(`should have property ${ds}`, (t) => {
        const { shim } = t.nr
        assert.ok(DatastoreShim[ds])
        assert.ok(shim[ds])
      })
    }
  })

  await t.test('#logger', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('logger should be a non-writable property', function (t) {
      const { shim } = t.nr
      assert.throws(function () {
        shim.logger = 'foobar'
      })

      assert.ok(shim.logger)
      assert.notDeepEqual(shim.logger, 'foobar')
    })

    const logLevels = ['trace', 'debug', 'info', 'warn', 'error']
    for (const level of logLevels) {
      await t.test(`logger should have ${level} as a function`, (t) => {
        const { shim } = t.nr
        assert.ok(shim.logger[level] instanceof Function, 'should be function')
      })
    }
  })

  await t.test('#setDatastore', async (t) => {
    t.beforeEach(function (ctx) {
      ctx.nr = {}
      const agent = helper.loadMockedAgent()
      ctx.nr.shim = new DatastoreShim(agent, 'test-cassandra')
      ctx.nr.agent = agent
    })

    t.afterEach(function (ctx) {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should accept the id of a well-known datastore', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.setDatastore(shim.CASSANDRA)
      })

      assert.equal(shim._metrics.PREFIX, 'Cassandra')
    })

    await t.test(
      'should create custom metric names if the `datastoreId` is a string',
      function (t) {
        const { shim } = t.nr
        assert.doesNotThrow(function () {
          shim.setDatastore('Fake Datastore')
        })

        assert.equal(shim._metrics.PREFIX, 'Fake Datastore')
      }
    )

    await t.test("should update the shim's logger", function (t) {
      const { shim } = t.nr
      const original = shim.logger
      shim.setDatastore(shim.CASSANDRA)
      assert.notEqual(shim.logger, original)
      assert.equal(shim.logger.extra.datastore, 'Cassandra')
    })
  })

  await t.test('#setParser', async (t) => {
    t.beforeEach(function (ctx) {
      ctx.nr = {}
      const agent = helper.loadMockedAgent()
      // Use a shim without a parser set for these tests.
      const shim = new DatastoreShim(agent, 'test')
      shim._metrics = { PREFIX: '' }
      ctx.nr.shim = shim
      ctx.nr.agent = agent
    })

    t.afterEach(function (ctx) {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should default to an SQL parser', function (t) {
      const { shim } = t.nr
      shim.agent.config.transaction_tracer.record_sql = 'raw'
      const query = 'SELECT 1 FROM test'
      const parsed = shim.parseQuery(query)
      assert.equal(parsed.operation, 'select')
      assert.equal(parsed.collection, 'test')
      assert.equal(parsed.raw, query)
    })

    await t.test('should allow for the parser to be set', function (t) {
      const { shim } = t.nr
      let testValue = false
      shim.setParser(function fakeParser(query) {
        assert.equal(query, 'foobar')
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.parseQuery('foobar')
      assert.ok(testValue)
    })

    await t.test('should have constants to set the query parser with', function (t) {
      const { shim } = t.nr
      shim.agent.config.transaction_tracer.record_sql = 'raw'
      shim.setParser(shim.SQL_PARSER)
      const query = 'SELECT 1 FROM test'
      const parsed = shim.parseQuery(query)
      assert.equal(parsed.operation, 'select')
      assert.equal(parsed.collection, 'test')
      assert.equal(parsed.raw, query)
    })

    await t.test('should not set parser to a new parser with invalid string', function (t) {
      const { shim } = t.nr
      let testValue = false
      shim.setParser(function fakeParser(query) {
        assert.equal(query, 'SELECT 1 FROM test')
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.setParser('bad string')
      const query = 'SELECT 1 FROM test'
      shim.parseQuery(query)
      assert.ok(testValue)
    })

    await t.test('should not set parser to a new parser with an object', function (t) {
      const { shim } = t.nr
      let testValue = false
      shim.setParser(function fakeParser(query) {
        assert.equal(query, 'SELECT 1 FROM test')
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.setParser({
        parser: function shouldNotBeCalled() {
          throw new Error('get me outta here')
        }
      })
      const query = 'SELECT 1 FROM test'
      shim.parseQuery(query)
      assert.ok(testValue)
    })
  })

  await t.test('#recordOperation', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordOperation(wrappable)
      assert.equal(wrapped, wrappable)
      assert.equal(shim.isWrapped(wrapped), false)
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordOperation(wrappable.bar, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordOperation(wrappable.bar, null, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordOperation(wrappable, 'bar', {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordOperation(wrappable, 'name', {})
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test(
      'should create a datastore operation segment but no metric when `record` is false',
      function (t, end) {
        const { agent, shim, wrappable } = t.nr
        shim.recordOperation(wrappable, 'getActiveSegment', {
          record: false,
          name: 'getActiveSegment'
        })

        helper.runInTransaction(agent, function () {
          const startingSegment = agent.tracer.getSegment()
          const segment = wrappable.getActiveSegment()
          assert.notEqual(segment, startingSegment)
          assert.equal(segment.name, 'getActiveSegment')
          assert.equal(agent.tracer.getSegment(), startingSegment)
          end()
        })
      }
    )

    await t.test(
      'should create a datastore operation metric when `record` is true',
      function (t, end) {
        const { agent, shim, wrappable } = t.nr
        shim.recordOperation(wrappable, 'getActiveSegment', {
          record: true,
          name: 'getActiveSegment'
        })

        helper.runInTransaction(agent, function () {
          const startingSegment = agent.tracer.getSegment()
          const segment = wrappable.getActiveSegment()
          assert.notEqual(segment, startingSegment)
          assert.equal(segment.name, 'Datastore/operation/Cassandra/getActiveSegment')
          assert.equal(agent.tracer.getSegment(), startingSegment)
          end()
        })
      }
    )

    await t.test(
      'should create a datastore operation metric when `record` is defaulted',
      function (t, end) {
        const { agent, shim, wrappable } = t.nr
        shim.recordOperation(wrappable, 'getActiveSegment', { name: 'getActiveSegment' })

        helper.runInTransaction(agent, function () {
          const startingSegment = agent.tracer.getSegment()
          const segment = wrappable.getActiveSegment()
          assert.notEqual(segment, startingSegment)
          assert.equal(segment.name, 'Datastore/operation/Cassandra/getActiveSegment')
          assert.equal(agent.tracer.getSegment(), startingSegment)
          end()
        })
      }
    )

    await t.test('should create a child segment when opaque is false', (t, end) => {
      const { agent, shim, wrappable } = t.nr
      shim.recordOperation(wrappable, 'withNested', () => new OperationSpec({ name: 'test', opaque: false }))
      helper.runInTransaction(agent, (tx) => {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.withNested()
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'Datastore/operation/Cassandra/test')

        const children = tx.trace.getChildren(segment.id)
        assert.equal(children.length, 1)
        const [childSegment] = children
        assert.equal(childSegment.name, 'ChildSegment')
        end()
      })
    })

    await t.test('should not create a child segment when opaque is true', (t, end) => {
      const { agent, shim, wrappable } = t.nr
      shim.recordOperation(wrappable, 'withNested', () => new OperationSpec({ name: 'test', opaque: true }))
      helper.runInTransaction(agent, (tx) => {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.withNested()
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'Datastore/operation/Cassandra/test')
        const children = tx.trace.getChildren(segment.id)
        assert.equal(children.length, 0)
        end()
      })
    })

    await t.test('should execute the wrapped function', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordOperation(toWrap, {})

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
        shim.recordOperation(wrappable, 'bar', function (_, fn, name, args) {
          executed = true
          assert.equal(fn, original)
          assert.equal(name, 'bar')
          assert.equal(this, wrappable)
          assert.deepEqual(args, ['a', 'b', 'c'])
          return {}
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
      const wrapped = shim.recordOperation(checkWrappedCb.bind(null, shim, end), {
        callback: shim.LAST
      })

      helper.runInTransaction(agent, function () {
        wrapped(end)
      })
    })
  })

  await t.test('with `parameters`', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { agent, shim, wrappable } = ctx.nr
      ctx.nr.localhost = getMetricHostName(agent, 'localhost')
      shim.recordOperation(wrappable, 'getActiveSegment', function (s, fn, n, args) {
        return new OperationSpec({ parameters: args[0] })
      })
    })
    t.afterEach(afterEach)

    function run(ctx, parameters, cb) {
      const { agent, wrappable } = ctx.nr
      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment(parameters)
        cb(segment)
      })
    }

    await t.test('should set datastore attributes accordingly', function (t, end) {
      const { localhost } = t.nr
      run(
        t,
        {
          host: 'localhost',
          port_path_or_id: 1234,
          database_name: 'foobar'
        },
        function (segment) {
          assert.ok(segment.attributes)
          const attributes = segment.getAttributes()
          assert.equal(attributes.host, localhost)
          assert.equal(attributes.port_path_or_id, '1234')
          assert.equal(attributes.database_name, 'foobar')
          end()
        }
      )
    })

    await t.test('should default undefined attributes to `unknown`', function (t, end) {
      run(
        t,
        {
          host: 'some_other_host',
          port_path_or_id: null,
          database_name: null
        },
        function (segment) {
          assert.ok(segment.attributes)
          const attributes = segment.getAttributes()
          assert.equal(attributes.host, 'some_other_host')
          assert.equal(attributes.port_path_or_id, 'unknown')
          assert.equal(attributes.database_name, 'unknown')
          end()
        }
      )
    })

    await t.test('should remove `database_name` if disabled', function (t, end) {
      const { localhost } = t.nr
      t.nr.agent.config.datastore_tracer.database_name_reporting.enabled = false
      run(
        t,
        {
          host: 'localhost',
          port_path_or_id: 1234,
          database_name: 'foobar'
        },
        function (segment) {
          assert.ok(segment.attributes)
          const attributes = segment.getAttributes()
          assert.equal(attributes.host, localhost)
          assert.equal(attributes.port_path_or_id, '1234')
          assert.ok(!attributes.database_name)
          end()
        }
      )
    })

    await t.test('should remove `host` and `port_path_or_id` if disabled', function (t, end) {
      t.nr.agent.config.datastore_tracer.instance_reporting.enabled = false
      run(
        t,
        {
          host: 'localhost',
          port_path_or_id: 1234,
          database_name: 'foobar'
        },
        function (segment) {
          assert.ok(segment.attributes)
          const attributes = segment.getAttributes()
          assert.ok(!attributes.host)
          assert.ok(!attributes.port_path_or_id)
          assert.equal(attributes.database_name, 'foobar')
          end()
        }
      )
    })
  })

  await t.test('recorder should create unscoped datastore metrics', function (t, end) {
    beforeEach(t)
    const { agent, shim, wrappable } = t.nr
    t.after(afterEach)
    shim.recordOperation(wrappable, 'getActiveSegment', function () {
      return new OperationSpec({
        name: 'op',
        parameters: {
          host: 'some_host',
          port_path_or_id: 1234,
          database_name: 'foobar'
        }
      })
    })

    helper.runInTransaction(agent, function (tx) {
      wrappable.getActiveSegment()
      tx.end()
      const { unscoped: metrics } = helper.getMetrics(agent)
      assert.ok(metrics['Datastore/all'])
      assert.ok(metrics['Datastore/allWeb'])
      assert.ok(metrics['Datastore/Cassandra/all'])
      assert.ok(metrics['Datastore/Cassandra/allWeb'])
      assert.ok(metrics['Datastore/operation/Cassandra/op'])
      assert.ok(metrics['Datastore/instance/Cassandra/some_host/1234'])
      end()
    })
  })

  await t.test('#recordQuery', async function (t) {
    const query = 'SELECT property FROM my_table'

    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordQuery(wrappable)
      assert.equal(wrapped, wrappable)
      assert.ok(!shim.isWrapped(wrapped))
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordQuery(wrappable.bar, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordQuery(wrappable.bar, null, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordQuery(wrappable, 'bar', {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordQuery(wrappable, 'name', {})
      assert.ok(!shim.isWrapped(wrappable.name))
    })

    await t.test(
      'should create a datastore query segment but no metric when `record` is false',
      function (t, end) {
        const { agent, shim, wrappable } = t.nr
        shim.recordQuery(
          wrappable,
          'getActiveSegment',
          new QuerySpec({
            query: shim.FIRST,
            record: false,
            name: 'getActiveSegment'
          })
        )

        helper.runInTransaction(agent, function () {
          const startingSegment = agent.tracer.getSegment()
          const segment = wrappable.getActiveSegment(query)
          assert.notEqual(segment, startingSegment)
          assert.equal(segment.name, 'getActiveSegment')
          assert.equal(agent.tracer.getSegment(), startingSegment)
          end()
        })
      }
    )

    await t.test('should create a datastore query metric when `record` is true', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordQuery(
        wrappable,
        'getActiveSegment',
        new QuerySpec({ query: shim.FIRST, record: true })
      )

      helper.runInTransaction(agent, function () {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment(query)
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'Datastore/statement/Cassandra/my_table/select')
        assert.equal(agent.tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test(
      'should create a datastore query metric when `record` is defaulted',
      function (t, end) {
        const { agent, shim, wrappable } = t.nr
        shim.recordQuery(wrappable, 'getActiveSegment', new QuerySpec({ query: shim.FIRST }))

        helper.runInTransaction(agent, function () {
          const startingSegment = agent.tracer.getSegment()
          const segment = wrappable.getActiveSegment(query)
          assert.notEqual(segment, startingSegment)
          assert.equal(segment.name, 'Datastore/statement/Cassandra/my_table/select')
          assert.equal(agent.tracer.getSegment(), startingSegment)
          end()
        })
      }
    )

    await t.test('should execute the wrapped function', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordQuery(toWrap, {})

      helper.runInTransaction(agent, function () {
        assert.equal(executed, false)
        wrapped()
        assert.equal(executed, true)
        end()
      })
    })

    await t.test('should allow after handlers to be specified', function (t, end) {
      const { agent, shim } = t.nr
      let executed = false
      const toWrap = function () {}
      const wrapped = shim.recordQuery(
        toWrap,
        new QuerySpec({
          query: function () {
            return 'test'
          },
          after: function () {
            executed = true
          }
        })
      )

      helper.runInTransaction(agent, function () {
        assert.equal(executed, false)
        wrapped()
        assert.equal(executed, true)
        end()
      })
    })

    await t.test('should bind the callback if there is one', function (t, end) {
      const { agent, shim } = t.nr
      const wrapped = shim.recordQuery(
        checkWrappedCb.bind(null, shim, end),
        new QuerySpec({
          query: shim.FIRST,
          callback: shim.LAST
        })
      )

      helper.runInTransaction(agent, function () {
        wrapped(query, end)
      })
    })

    await t.test('should bind the row callback if there is one', function (t, end) {
      const { agent, shim } = t.nr
      const wrapped = shim.recordQuery(
        checkWrappedCb.bind(null, shim, end),
        new QuerySpec({
          query: shim.FIRST,
          rowCallback: shim.LAST
        })
      )

      helper.runInTransaction(agent, function () {
        wrapped(query, end)
      })
    })

    await t.test('should execute inContext function when specified in spec', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordQuery(
        wrappable,
        'bar',
        new QuerySpec({
          query: 'select foo from bar;',
          inContext(segment) {
            segment.addAttribute('test-attr', 'unit-test')
          }
        })
      )

      helper.runInTransaction(agent, (tx) => {
        wrappable.bar()
        const rootSegment = agent.tracer.getSegment()
        const [child] = tx.trace.getChildren(rootSegment.id)
        const attrs = child.getAttributes()
        assert.equal(
          attrs['test-attr'],
          'unit-test',
          'should add attribute to segment while in context'
        )
        tx.end()
        end()
      })
    })
  })

  await t.test('#recordBatchQuery', async function (t) {
    const query = 'SELECT property FROM my_table'

    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordBatchQuery(wrappable)
      assert.equal(wrapped, wrappable)
      assert.ok(!shim.isWrapped(wrapped))
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordBatchQuery(wrappable.bar, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordBatchQuery(wrappable.bar, null, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordBatchQuery(wrappable, 'bar', {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordBatchQuery(wrappable, 'name', {})
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should create a datastore batch query metric', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordBatchQuery(wrappable, 'getActiveSegment', new QuerySpec({ query: shim.FIRST }))

      helper.runInTransaction(agent, function () {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment(query)
        assert.notEqual(segment, startingSegment)
        assert.equal(segment.name, 'Datastore/statement/Cassandra/my_table/select/batch')
        assert.equal(agent.tracer.getSegment(), startingSegment)
        end()
      })
    })

    await t.test('should execute the wrapped function', function (t) {
      const { shim } = t.nr
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordBatchQuery(toWrap, {})
      assert.equal(executed, false)
      wrapped()
      assert.equal(executed, true)
    })
  })

  await t.test('#parseQuery', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should parse a query string into a ParsedStatement', function (t) {
      const { shim } = t.nr
      const statement = shim.parseQuery('SELECT * FROM table')
      assert.ok(statement instanceof ParsedStatement)
    })

    await t.test('should strip enclosing special characters from collection', function (t) {
      const { shim } = t.nr
      assert.equal(shim.parseQuery('select * from [table]').collection, 'table')
      assert.equal(shim.parseQuery('select * from {table}').collection, 'table')
      assert.equal(shim.parseQuery("select * from 'table'").collection, 'table')
      assert.equal(shim.parseQuery('select * from "table"').collection, 'table')
      assert.equal(shim.parseQuery('select * from `table`').collection, 'table')
    })
  })

  await t.test('#bindRowCallbackSegment', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should wrap the identified argument', function (t) {
      const { shim, wrappable } = t.nr
      const args = [1, 2, wrappable.bar]
      shim.bindRowCallbackSegment(args, shim.LAST)

      assert.notEqual(args[2], wrappable.bar)
      assert.equal(shim.isWrapped(args[2]), true)
      assert.equal(shim.unwrap(args[2]), wrappable.bar)
    })

    await t.test('should not wrap if the index is invalid', function (t) {
      const { shim, wrappable } = t.nr
      const args = [1, 2, wrappable.bar]

      assert.doesNotThrow(function () {
        shim.bindRowCallbackSegment(args, 50)
      })

      assert.equal(args[2], wrappable.bar)
      assert.ok(!shim.isWrapped(args[2]))
    })

    await t.test('should not wrap the argument if it is not a function', function (t) {
      const { shim, wrappable } = t.nr
      const args = [1, 2, wrappable.bar]

      assert.doesNotThrow(function () {
        shim.bindRowCallbackSegment(args, 1)
      })

      assert.equal(args[1], 2)
      assert.ok(!shim.isWrapped(args[1]))
      assert.equal(args[2], wrappable.bar)
      assert.ok(!shim.isWrapped(args[2]))
    })

    await t.test('should create a new segment on the first call', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      helper.runInTransaction(agent, function (tx) {
        const args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment
        const segment = shim.getSegment()
        const cbSegment = args[2]()
        assert.notEqual(cbSegment, segment)
        const children = tx.trace.getChildren(segment.id)
        assert.ok(children.includes(cbSegment))
        end()
      })
    })

    await t.test('should not create a new segment for calls after the first', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      helper.runInTransaction(agent, function (tx) {
        const args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment from the first call.
        const segment = shim.getSegment()
        const cbSegment = args[2]()
        assert.notEqual(cbSegment, segment)
        let children = tx.trace.getChildren(segment.id)
        assert.ok(children.includes(cbSegment))
        assert.equal(children.length, 1)

        // Call it a second time and see if we have the same segment.
        const cbSegment2 = args[2]()
        assert.equal(cbSegment2, cbSegment)
        children = tx.trace.getChildren(segment.id)
        assert.equal(children.length, 1)
        end()
      })
    })

    await t.test('should name the segment based on number of calls', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      helper.runInTransaction(agent, function () {
        const args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment from the first call.
        const cbSegment = args[2]()
        assert.match(cbSegment.name, /^Callback: getActiveSegment/)
        assert.equal(cbSegment.getAttributes().count, 1)

        // Call it a second time and see if the name changed.
        args[2]()
        assert.equal(cbSegment.getAttributes().count, 2)

        // And a third time, why not?
        args[2]()
        assert.equal(cbSegment.getAttributes().count, 3)
        end()
      })
    })
  })

  await t.test('#captureInstanceAttributes', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not crash outside of a transaction', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.captureInstanceAttributes('foo', 123, 'bar')
      })
    })

    await t.test('should not add parameters to segments it did not create', function (t, end) {
      const { agent, shim } = t.nr
      const bound = agent.tracer.wrapFunction(
        'foo',
        null,
        function (host, port, db) {
          shim.captureInstanceAttributes(host, port, db)
          return shim.getSegment()
        },
        function (segment, args) {
          return args
        }
      )

      helper.runInTransaction(agent, function () {
        const segment = bound('foobar', 123, 'bar')
        assert.ok(segment.attributes)
        const attributes = segment.getAttributes()
        assert.ok(!attributes.host)
        assert.ok(!attributes.port_path_or_id)
        assert.ok(!attributes.database_name)
        end()
      })
    })

    await t.test('should add normalized attributes to its own segments', function (t, end) {
      const { agent, shim } = t.nr
      const wrapped = shim.recordOperation(function (host, port, db) {
        shim.captureInstanceAttributes(host, port, db)
        return shim.getSegment()
      })

      helper.runInTransaction(agent, function () {
        const segment = wrapped('foobar', 123, 'bar')
        assert.ok(segment.attributes)
        const attributes = segment.getAttributes()
        assert.equal(attributes.host, 'foobar')
        assert.equal(attributes.port_path_or_id, '123')
        assert.equal(attributes.database_name, 'bar')
        end()
      })
    })
  })

  await t.test('#getDatabaseNameFromUseQuery', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should match single statement use expressions', (t) => {
      const { shim } = t.nr
      assert.equal(shim.getDatabaseNameFromUseQuery('use test_db;'), 'test_db')
      assert.equal(shim.getDatabaseNameFromUseQuery('USE INIT'), 'INIT')
    })

    await t.test('should not be sensitive to ; omission', (t) => {
      const { shim } = t.nr
      assert.equal(shim.getDatabaseNameFromUseQuery('use test_db'), 'test_db')
    })

    await t.test('should not be sensitive to extra ;', (t) => {
      const { shim } = t.nr
      assert.equal(shim.getDatabaseNameFromUseQuery('use test_db;;;;;;'), 'test_db')
    })

    await t.test('should not be sensitive to extra white space', (t) => {
      const { shim } = t.nr
      assert.equal(shim.getDatabaseNameFromUseQuery('            use test_db;'), 'test_db')
      assert.equal(shim.getDatabaseNameFromUseQuery('use             test_db;'), 'test_db')
      assert.equal(shim.getDatabaseNameFromUseQuery('use test_db            ;'), 'test_db')
      assert.equal(shim.getDatabaseNameFromUseQuery('use test_db;            '), 'test_db')
    })

    await t.test('should match backtick expressions', (t) => {
      const { shim } = t.nr
      assert.equal(shim.getDatabaseNameFromUseQuery('use `test_db`;'), '`test_db`')
      assert.equal(shim.getDatabaseNameFromUseQuery('use `☃☃☃☃☃☃`;'), '`☃☃☃☃☃☃`')
    })

    await t.test('should not match malformed use expressions', (t) => {
      const { shim } = t.nr
      assert.equal(shim.getDatabaseNameFromUseQuery('use cxvozicjvzocixjv`oasidfjaosdfij`;'), null)
      assert.equal(shim.getDatabaseNameFromUseQuery('use `oasidfjaosdfij`123;'), null)
      assert.equal(shim.getDatabaseNameFromUseQuery('use `oasidfjaosdfij` 123;'), null)
      assert.equal(shim.getDatabaseNameFromUseQuery('use \u0001;'), null)
      assert.equal(shim.getDatabaseNameFromUseQuery('use oasidfjaosdfij 123;'), null)
    })
  })
})
