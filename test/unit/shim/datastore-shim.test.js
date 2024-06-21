/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { test } = tap
const getMetricHostName = require('../../lib/metrics_helper').getMetricHostName
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const ParsedStatement = require('../../../lib/db/parsed-statement')
const { QuerySpec, OperationSpec } = require('../../../lib/shim/specs')

test('DatastoreShim', function (t) {
  t.autoend()
  let agent = null
  let shim = null
  let wrappable = null

  function beforeEach() {
    agent = helper.loadMockedAgent()
    shim = new DatastoreShim(agent, 'test-cassandra')
    shim.setDatastore(DatastoreShim.CASSANDRA)
    wrappable = {
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
        const segment = agent.tracer.getSegment()
        segment.add('ChildSegment')

        return segment
      }
    }
  }

  function afterEach() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  }

  t.test('constructor', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should inherit from Shim', function (t) {
      t.ok(shim instanceof DatastoreShim)
      t.ok(shim instanceof Shim)
      t.end()
    })

    t.test('should require the `agent` parameter', function (t) {
      t.throws(() => new DatastoreShim(), /^Shim must be initialized with .*? agent/)
      t.end()
    })

    t.test('should require the `moduleName` parameter', function (t) {
      t.throws(() => new DatastoreShim(agent), /^Shim must be initialized with .*? module name/)
      t.end()
    })

    t.test('should take an optional `datastore`', function (t) {
      // Test without datastore
      let _shim = null
      t.doesNotThrow(function () {
        _shim = new DatastoreShim(agent, 'test-cassandra')
      })
      t.notOk(_shim._metrics)

      // Use one provided for all tests to check constructed with datastore
      t.ok(shim._metrics)
      t.end()
    })

    t.test('should assign properties from parent', (t) => {
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new DatastoreShim(agent, mod, mod, name, version)
      t.equal(shim.moduleName, mod)
      t.equal(agent, shim._agent)
      t.equal(shim.pkgVersion, version)
      t.end()
    })
  })

  t.test('well-known datastores', (t) => {
    t.autoend()
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
    datastores.forEach((ds) => {
      t.test(`should have property ${ds}`, (t) => {
        t.ok(DatastoreShim[ds])
        t.ok(shim[ds])
        t.end()
      })
    })
  })

  t.test('#logger', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('logger should be a non-writable property', function (t) {
      t.throws(function () {
        shim.logger = 'foobar'
      })

      t.ok(shim.logger)
      t.not(shim.logger, 'foobar')
      t.end()
    })

    const logLevels = ['trace', 'debug', 'info', 'warn', 'error']
    logLevels.forEach((level) => {
      t.test(`logger should have ${level} as a function`, (t) => {
        t.ok(shim.logger[level] instanceof Function, 'should be function')
        t.end()
      })
    })
  })

  t.test('#setDatastore', (t) => {
    t.autoend()
    let dsAgent = null
    let dsShim = null

    t.beforeEach(function () {
      dsAgent = helper.loadMockedAgent()
      dsShim = new DatastoreShim(dsAgent, 'test-cassandra')
    })

    t.afterEach(function () {
      dsShim = null
      dsAgent = helper.unloadAgent(dsAgent)
    })

    t.test('should accept the id of a well-known datastore', function (t) {
      t.doesNotThrow(function () {
        dsShim.setDatastore(dsShim.CASSANDRA)
      })

      t.ok(dsShim._metrics.PREFIX, 'Cassandra')
      t.end()
    })

    t.test('should create custom metric names if the `datastoreId` is a string', function (t) {
      t.doesNotThrow(function () {
        dsShim.setDatastore('Fake Datastore')
      })

      t.ok(dsShim._metrics.PREFIX, 'Fake Datastore')
      t.end()
    })

    t.test("should update the dsShim's logger", function (t) {
      const original = dsShim.logger
      dsShim.setDatastore(dsShim.CASSANDRA)
      t.not(dsShim.logger, original)
      t.ok(dsShim.logger.extra.datastore, 'Cassandra')
      t.end()
    })
  })

  t.test('#setParser', (t) => {
    t.autoend()
    let parserAgent = null
    let parserShim = null

    t.beforeEach(function () {
      parserAgent = helper.loadMockedAgent()
      // Use a parserShim without a parser set for these tests.
      parserShim = new DatastoreShim(parserAgent, 'test')
      parserShim._metrics = { PREFIX: '' }
    })

    t.afterEach(function () {
      parserShim = null
      parserAgent = helper.unloadAgent(parserAgent)
    })

    t.test('should default to an SQL parser', function (t) {
      parserShim.agent.config.transaction_tracer.record_sql = 'raw'
      const query = 'SELECT 1 FROM test'
      const parsed = parserShim.parseQuery(query)
      t.equal(parsed.operation, 'select')
      t.equal(parsed.collection, 'test')
      t.equal(parsed.raw, query)
      t.end()
    })

    t.test('should allow for the parser to be set', function (t) {
      let testValue = false
      parserShim.setParser(function fakeParser(query) {
        t.equal(query, 'foobar')
        testValue = true
        return {
          operation: 'test'
        }
      })
      parserShim.parseQuery('foobar')
      t.ok(testValue)
      t.end()
    })

    t.test('should have constants to set the query parser with', function (t) {
      parserShim.agent.config.transaction_tracer.record_sql = 'raw'
      parserShim.setParser(parserShim.SQL_PARSER)
      const query = 'SELECT 1 FROM test'
      const parsed = parserShim.parseQuery(query)
      t.equal(parsed.operation, 'select')
      t.equal(parsed.collection, 'test')
      t.equal(parsed.raw, query)
      t.end()
    })

    t.test('should not set parser to a new parser with invalid string', function (t) {
      let testValue = false
      parserShim.setParser(function fakeParser(query) {
        t.equal(query, 'SELECT 1 FROM test')
        testValue = true
        return {
          operation: 'test'
        }
      })
      parserShim.setParser('bad string')
      const query = 'SELECT 1 FROM test'
      parserShim.parseQuery(query)
      t.ok(testValue)
      t.end()
    })

    t.test('should not set parser to a new parser with an object', function (t) {
      let testValue = false
      parserShim.setParser(function fakeParser(query) {
        t.equal(query, 'SELECT 1 FROM test')
        testValue = true
        return {
          operation: 'test'
        }
      })
      parserShim.setParser({
        parser: function shouldNotBeCalled() {
          throw new Error('get me outta here')
        }
      })
      const query = 'SELECT 1 FROM test'
      parserShim.parseQuery(query)
      t.ok(testValue)
      t.end()
    })
  })
  t.test('#recordOperation', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordOperation(wrappable)
      t.equal(wrapped, wrappable)
      t.not(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordOperation(wrappable.bar, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordOperation(wrappable.bar, null, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordOperation(wrappable, 'bar', {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordOperation(wrappable, 'name', {})
      t.not(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test(
      'should create a datastore operation segment but no metric when `record` is false',
      function (t) {
        shim.recordOperation(wrappable, 'getActiveSegment', {
          record: false,
          name: 'getActiveSegment'
        })

        helper.runInTransaction(agent, function (tx) {
          const startingSegment = agent.tracer.getSegment()
          const segment = wrappable.getActiveSegment()
          t.not(segment, startingSegment)
          t.equal(segment.transaction, tx)
          t.equal(segment.name, 'getActiveSegment')
          t.equal(agent.tracer.getSegment(), startingSegment)
          t.end()
        })
      }
    )

    t.test('should create a datastore operation metric when `record` is true', function (t) {
      shim.recordOperation(wrappable, 'getActiveSegment', {
        record: true,
        name: 'getActiveSegment'
      })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment()
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'Datastore/operation/Cassandra/getActiveSegment')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should create a datastore operation metric when `record` is defaulted', function (t) {
      shim.recordOperation(wrappable, 'getActiveSegment', { name: 'getActiveSegment' })

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment()
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'Datastore/operation/Cassandra/getActiveSegment')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should create a child segment when opaque is false', (t) => {
      shim.recordOperation(wrappable, 'withNested', () => {
        return new OperationSpec({ name: 'test', opaque: false })
      })
      helper.runInTransaction(agent, (tx) => {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.withNested()
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'Datastore/operation/Cassandra/test')
        t.equal(segment.children.length, 1)
        const [childSegment] = segment.children
        t.equal(childSegment.name, 'ChildSegment')
        t.end()
      })
    })

    t.test('should not create a child segment when opaque is true', (t) => {
      shim.recordOperation(wrappable, 'withNested', () => {
        return new OperationSpec({ name: 'test', opaque: true })
      })
      helper.runInTransaction(agent, (tx) => {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.withNested()
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'Datastore/operation/Cassandra/test')
        t.equal(segment.children.length, 0)
        t.end()
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordOperation(toWrap, {})

      helper.runInTransaction(agent, function () {
        t.not(executed)
        wrapped()
        t.ok(executed)
        t.end()
      })
    })

    t.test('should invoke the spec in the context of the wrapped function', function (t) {
      const original = wrappable.bar
      let executed = false
      shim.recordOperation(wrappable, 'bar', function (_, fn, name, args) {
        executed = true
        t.equal(fn, original)
        t.equal(name, 'bar')
        t.equal(this, wrappable)
        t.same(args, ['a', 'b', 'c'])
        return {}
      })

      helper.runInTransaction(agent, function () {
        wrappable.bar('a', 'b', 'c')
        t.ok(executed)
        t.end()
      })
    })

    t.test('should bind the callback if there is one', function (t) {
      const cb = function () {}

      const wrapped = shim.recordOperation(helper.checkWrappedCb.bind(t, shim, cb), {
        callback: shim.LAST
      })

      helper.runInTransaction(agent, function () {
        wrapped(cb)
      })
    })
  })

  t.test('with `parameters`', function (t) {
    t.autoend()
    let localhost = null
    t.beforeEach(function () {
      beforeEach()
      localhost = getMetricHostName(agent, 'localhost')
      shim.recordOperation(wrappable, 'getActiveSegment', function (s, fn, n, args) {
        return new OperationSpec({ parameters: args[0] })
      })
    })
    t.afterEach(afterEach)

    function run(parameters, cb) {
      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment(parameters)
        cb(segment)
      })
    }

    t.test('should set datatastore attributes accordingly', function (t) {
      run(
        {
          host: 'localhost',
          port_path_or_id: 1234,
          database_name: 'foobar'
        },
        function (segment) {
          t.ok(segment.attributes)
          const attributes = segment.getAttributes()
          t.equal(attributes.host, localhost)
          t.equal(attributes.port_path_or_id, '1234')
          t.equal(attributes.database_name, 'foobar')
          t.end()
        }
      )
    })

    t.test('should default undefined attributes to `unknown`', function (t) {
      run(
        {
          host: 'some_other_host',
          port_path_or_id: null,
          database_name: null
        },
        function (segment) {
          t.ok(segment.attributes)
          const attributes = segment.getAttributes()
          t.equal(attributes.host, 'some_other_host')
          t.equal(attributes.port_path_or_id, 'unknown')
          t.equal(attributes.database_name, 'unknown')
          t.end()
        }
      )
    })

    t.test('should remove `database_name` if disabled', function (t) {
      agent.config.datastore_tracer.database_name_reporting.enabled = false
      run(
        {
          host: 'localhost',
          port_path_or_id: 1234,
          database_name: 'foobar'
        },
        function (segment) {
          t.ok(segment.attributes)
          const attributes = segment.getAttributes()
          t.equal(attributes.host, localhost)
          t.equal(attributes.port_path_or_id, '1234')
          t.notOk(attributes.database_name)
          t.end()
        }
      )
    })

    t.test('should remove `host` and `port_path_or_id` if disabled', function (t) {
      agent.config.datastore_tracer.instance_reporting.enabled = false
      run(
        {
          host: 'localhost',
          port_path_or_id: 1234,
          database_name: 'foobar'
        },
        function (segment) {
          t.ok(segment.attributes)
          const attributes = segment.getAttributes()
          t.notOk(attributes.host)
          t.notOk(attributes.port_path_or_id)
          t.equal(attributes.database_name, 'foobar')
          t.end()
        }
      )
    })
  })

  t.test('recorder', function (t) {
    t.autoend()
    t.beforeEach(function () {
      beforeEach()
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

      return new Promise((resolve) => {
        helper.runInTransaction(agent, function (tx) {
          wrappable.getActiveSegment()
          tx.end()
          resolve()
        })
      })
    })

    t.afterEach(afterEach)

    t.test('should create unscoped datastore metrics', function (t) {
      const { unscoped: metrics } = helper.getMetrics(agent)
      t.ok(metrics['Datastore/all'])
      t.ok(metrics['Datastore/allWeb'])
      t.ok(metrics['Datastore/Cassandra/all'])
      t.ok(metrics['Datastore/Cassandra/allWeb'])
      t.ok(metrics['Datastore/operation/Cassandra/op'])
      t.ok(metrics['Datastore/instance/Cassandra/some_host/1234'])
      t.end()
    })
  })

  t.test('#recordQuery', function (t) {
    const query = 'SELECT property FROM my_table'
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordQuery(wrappable)
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordQuery(wrappable.bar, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordQuery(wrappable.bar, null, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordQuery(wrappable, 'bar', {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordQuery(wrappable, 'name', {})
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test(
      'should create a datastore query segment but no metric when `record` is false',
      function (t) {
        shim.recordQuery(
          wrappable,
          'getActiveSegment',
          new QuerySpec({
            query: shim.FIRST,
            record: false,
            name: 'getActiveSegment'
          })
        )

        helper.runInTransaction(agent, function (tx) {
          const startingSegment = agent.tracer.getSegment()
          const segment = wrappable.getActiveSegment(query)
          t.not(segment, startingSegment)
          t.equal(segment.transaction, tx)
          t.equal(segment.name, 'getActiveSegment')
          t.equal(agent.tracer.getSegment(), startingSegment)
          t.end()
        })
      }
    )

    t.test('should create a datastore query metric when `record` is true', function (t) {
      shim.recordQuery(
        wrappable,
        'getActiveSegment',
        new QuerySpec({ query: shim.FIRST, record: true })
      )

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment(query)
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'Datastore/statement/Cassandra/my_table/select')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should create a datastore query metric when `record` is defaulted', function (t) {
      shim.recordQuery(wrappable, 'getActiveSegment', new QuerySpec({ query: shim.FIRST }))

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment(query)
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'Datastore/statement/Cassandra/my_table/select')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordQuery(toWrap, {})

      helper.runInTransaction(agent, function () {
        t.notOk(executed)
        wrapped()
        t.ok(executed)
        t.end()
      })
    })

    t.test('should allow after handlers to be specified', function (t) {
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
        t.notOk(executed)
        wrapped()
        t.ok(executed)
        t.end()
      })
    })

    t.test('should bind the callback if there is one', function (t) {
      const cb = function () {}
      const wrapped = shim.recordQuery(
        helper.checkWrappedCb.bind(t, shim, cb),
        new QuerySpec({
          query: shim.FIRST,
          callback: shim.LAST
        })
      )

      helper.runInTransaction(agent, function () {
        wrapped(query, cb)
      })
    })

    t.test('should bind the row callback if there is one', function (t) {
      const cb = function () {}

      const wrapped = shim.recordQuery(
        helper.checkWrappedCb.bind(t, shim, cb),
        new QuerySpec({
          query: shim.FIRST,
          rowCallback: shim.LAST
        })
      )

      helper.runInTransaction(agent, function () {
        wrapped(query, cb)
      })
    })

    t.test('should execute inContext function when specified in spec', function (t) {
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
        const attrs = rootSegment.children[0].getAttributes()
        t.equal(attrs['test-attr'], 'unit-test', 'should add attribute to segment while in context')
        tx.end()
        t.end()
      })
    })
  })

  t.test('#recordBatchQuery', function (t) {
    const query = 'SELECT property FROM my_table'
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordBatchQuery(wrappable)
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordBatchQuery(wrappable.bar, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordBatchQuery(wrappable.bar, null, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordBatchQuery(wrappable, 'bar', {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordBatchQuery(wrappable, 'name', {})
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should create a datastore batch query metric', function (t) {
      shim.recordBatchQuery(wrappable, 'getActiveSegment', new QuerySpec({ query: shim.FIRST }))

      helper.runInTransaction(agent, function (tx) {
        const startingSegment = agent.tracer.getSegment()
        const segment = wrappable.getActiveSegment(query)
        t.not(segment, startingSegment)
        t.equal(segment.transaction, tx)
        t.equal(segment.name, 'Datastore/statement/Cassandra/my_table/select/batch')
        t.equal(agent.tracer.getSegment(), startingSegment)
        t.end()
      })
    })

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const toWrap = function () {
        executed = true
      }
      const wrapped = shim.recordBatchQuery(toWrap, {})
      t.notOk(executed)
      wrapped()
      t.ok(executed)
      t.end()
    })
  })

  t.test('#parseQuery', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should parse a query string into a ParsedStatement', function (t) {
      const statement = shim.parseQuery('SELECT * FROM table')
      t.ok(statement instanceof ParsedStatement)
      t.end()
    })

    t.test('should strip enclosing special characters from collection', function (t) {
      t.equal(shim.parseQuery('select * from [table]').collection, 'table')
      t.equal(shim.parseQuery('select * from {table}').collection, 'table')
      t.equal(shim.parseQuery("select * from 'table'").collection, 'table')
      t.equal(shim.parseQuery('select * from "table"').collection, 'table')
      t.equal(shim.parseQuery('select * from `table`').collection, 'table')
      t.end()
    })
  })

  t.test('#bindRowCallbackSegment', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should wrap the identified argument', function (t) {
      const args = [1, 2, wrappable.bar]
      shim.bindRowCallbackSegment(args, shim.LAST)

      t.not(args[2], wrappable.bar)
      t.ok(shim.isWrapped(args[2]))
      t.equal(shim.unwrap(args[2]), wrappable.bar)
      t.end()
    })

    t.test('should not wrap if the index is invalid', function (t) {
      const args = [1, 2, wrappable.bar]

      t.doesNotThrow(function () {
        shim.bindRowCallbackSegment(args, 50)
      })

      t.equal(args[2], wrappable.bar)
      t.notOk(shim.isWrapped(args[2]))
      t.end()
    })

    t.test('should not wrap the argument if it is not a function', function (t) {
      const args = [1, 2, wrappable.bar]

      t.doesNotThrow(function () {
        shim.bindRowCallbackSegment(args, 1)
      })

      t.equal(args[1], 2)
      t.notOk(shim.isWrapped(args[1]))
      t.equal(args[2], wrappable.bar)
      t.notOk(shim.isWrapped(args[2]))
      t.end()
    })

    t.test('should create a new segment on the first call', function (t) {
      helper.runInTransaction(agent, function () {
        const args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment
        const segment = shim.getSegment()
        const cbSegment = args[2]()
        t.not(cbSegment, segment)
        t.not(segment.children.includes(cbSegment))
        t.end()
      })
    })

    t.test('should not create a new segment for calls after the first', function (t) {
      helper.runInTransaction(agent, function () {
        const args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment from the first call.
        const segment = shim.getSegment()
        const cbSegment = args[2]()
        t.not(cbSegment, segment)
        t.ok(segment.children.includes(cbSegment))
        t.equal(segment.children.length, 1)

        // Call it a second time and see if we have the same segment.
        const cbSegment2 = args[2]()
        t.equal(cbSegment2, cbSegment)
        t.equal(segment.children.length, 1)
        t.end()
      })
    })

    t.test('should name the segment based on number of calls', function (t) {
      helper.runInTransaction(agent, function () {
        const args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment from the first call.
        const cbSegment = args[2]()
        t.match(cbSegment.name, /^Callback: getActiveSegment/)
        t.equal(cbSegment.getAttributes().count, 1)

        // Call it a second time and see if the name changed.
        args[2]()
        t.equal(cbSegment.getAttributes().count, 2)

        // And a third time, why not?
        args[2]()
        t.equal(cbSegment.getAttributes().count, 3)
        t.end()
      })
    })
  })

  t.test('#captureInstanceAttributes', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not crash outside of a transaction', function (t) {
      t.doesNotThrow(function () {
        shim.captureInstanceAttributes('foo', 123, 'bar')
      })
      t.end()
    })

    t.test('should not add parameters to segments it did not create', function (t) {
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
        t.ok(segment.attributes)
        const attributes = segment.getAttributes()
        t.notOk(attributes.host)
        t.notOk(attributes.port_path_or_id)
        t.notOk(attributes.database_name)
        t.end()
      })
    })

    t.test('should add normalized attributes to its own segments', function (t) {
      const wrapped = shim.recordOperation(function (host, port, db) {
        shim.captureInstanceAttributes(host, port, db)
        return shim.getSegment()
      })

      helper.runInTransaction(agent, function () {
        const segment = wrapped('foobar', 123, 'bar')
        t.ok(segment.attributes)
        const attributes = segment.getAttributes()
        t.equal(attributes.host, 'foobar')
        t.equal(attributes.port_path_or_id, '123')
        t.equal(attributes.database_name, 'bar')
        t.end()
      })
    })
  })

  t.test('#getDatabaseNameFromUseQuery', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should match single statement use expressions', (t) => {
      t.equal(shim.getDatabaseNameFromUseQuery('use test_db;'), 'test_db')
      t.equal(shim.getDatabaseNameFromUseQuery('USE INIT'), 'INIT')
      t.end()
    })

    t.test('should not be sensitive to ; omission', (t) => {
      t.equal(shim.getDatabaseNameFromUseQuery('use test_db'), 'test_db')
      t.end()
    })

    t.test('should not be sensitive to extra ;', (t) => {
      t.equal(shim.getDatabaseNameFromUseQuery('use test_db;;;;;;'), 'test_db')
      t.end()
    })

    t.test('should not be sensitive to extra white space', (t) => {
      t.equal(shim.getDatabaseNameFromUseQuery('            use test_db;'), 'test_db')
      t.equal(shim.getDatabaseNameFromUseQuery('use             test_db;'), 'test_db')
      t.equal(shim.getDatabaseNameFromUseQuery('use test_db            ;'), 'test_db')
      t.equal(shim.getDatabaseNameFromUseQuery('use test_db;            '), 'test_db')
      t.end()
    })

    t.test('should match backtick expressions', (t) => {
      t.equal(shim.getDatabaseNameFromUseQuery('use `test_db`;'), '`test_db`')
      t.equal(shim.getDatabaseNameFromUseQuery('use `☃☃☃☃☃☃`;'), '`☃☃☃☃☃☃`')
      t.end()
    })

    t.test('should not match malformed use expressions', (t) => {
      t.equal(shim.getDatabaseNameFromUseQuery('use cxvozicjvzocixjv`oasidfjaosdfij`;'), null)
      t.equal(shim.getDatabaseNameFromUseQuery('use `oasidfjaosdfij`123;'), null)
      t.equal(shim.getDatabaseNameFromUseQuery('use `oasidfjaosdfij` 123;'), null)
      t.equal(shim.getDatabaseNameFromUseQuery('use \u0001;'), null)
      t.equal(shim.getDatabaseNameFromUseQuery('use oasidfjaosdfij 123;'), null)
      t.end()
    })
  })
})
