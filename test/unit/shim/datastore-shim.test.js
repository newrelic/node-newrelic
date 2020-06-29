/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai = require('chai')
var expect = chai.expect
var getMetricHostName = require('../../lib/metrics_helper').getMetricHostName
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')
var DatastoreShim = require('../../../lib/shim/datastore-shim')
var ParsedStatement = require('../../../lib/db/parsed-statement')


describe('DatastoreShim', function() {
  var agent = null
  var shim = null
  var wrappable = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    shim = new DatastoreShim(agent, 'test-cassandra', null, DatastoreShim.CASSANDRA)
    wrappable = {
      name: 'this is a name',
      bar: function barsName() { return 'bar' },
      fiz: function fizsName() { return 'fiz' },
      anony: function() {},
      getActiveSegment: function getActiveSegment() {
        return agent.tracer.getSegment()
      },
      withNested: function() {
        const segment = agent.tracer.getSegment()
        segment.add('ChildSegment')

        return segment
      }
    }
  })

  afterEach(function() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  it('should inherit from Shim', function() {
    expect(shim)
      .to.be.an.instanceof(DatastoreShim)
      .and.an.instanceof(Shim)
  })

  describe('constructor', function() {
    it('should require the `agent` parameter', function() {
      expect(function() { return new DatastoreShim() })
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })

    it('should require the `moduleName` parameter', function() {
      expect(function() { return new DatastoreShim(agent) })
        .to.throw(Error, /^Shim must be initialized with .*? module name/)
    })

    it('should take an optional `datastore`', function() {
      // Test without datastore
      var _shim = null
      expect(function() {
        _shim = new DatastoreShim(agent, 'test-cassandra')
      }).to.not.throw()
      expect(_shim).to.not.have.property('_metrics')

      // Use one provided for all tests to check constructed with datastore
      expect(shim).to.have.property('_metrics')
    })
  })

  describe('well-known datastores', function() {
    it('should be enumerated on the class and prototype', function() {
      var datastores = [
        'CASSANDRA',
        'DYNAMODB',
        'MEMCACHED',
        'MONGODB',
        'MYSQL',
        'NEPTUNE',
        'REDIS',
        'POSTGRES'
      ]
      datastores.forEach(function(ds) {
        expect(DatastoreShim).to.have.property(ds)
        expect(shim).to.have.property(ds)
      })
    })
  })

  describe('#logger', function() {
    it('should be a non-writable property', function() {
      expect(function() {
        shim.logger = 'foobar'
      }).to.throw()

      expect(shim)
        .to.have.property('logger')
        .that.is.not.equal('foobar')
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

  describe('#setDatastore', function() {
    var shim = null

    beforeEach(function() {
      // Use a shim without a datastore set for these tests.
      shim = new DatastoreShim(agent, 'test-cassandra')
    })

    it('should accept the id of a well-known datastore', function() {
      expect(function() {
        shim.setDatastore(shim.CASSANDRA)
      }).to.not.throw()

      expect(shim)
        .to.have.property('_metrics')
        .that.has.property('PREFIX', 'Cassandra')
    })

    it('should create custom metric names if the `datastoreId` is a string', function() {
      expect(function() {
        shim.setDatastore('Fake Datastore')
      }).to.not.throw()

      expect(shim)
        .to.have.property('_metrics')
        .that.has.property('PREFIX', 'Fake Datastore')
    })

    it('should update the shim\'s logger', function() {
      var original = shim.logger
      shim.setDatastore(shim.CASSANDRA)
      expect(shim.logger)
        .to.not.equal(original)
      expect(shim.logger)
        .to.have.property('extra')
        .that.has.property('datastore', 'Cassandra')
    })
  })

  describe('#setParser', function() {
    var shim = null

    beforeEach(function() {
      // Use a shim without a parser set for these tests.
      shim = new DatastoreShim(agent, 'test')
      shim._metrics = {PREFIX: ''}
    })

    it('should default to an SQL parser', function() {
      shim.agent.config.transaction_tracer.record_sql = 'raw'
      var query = 'SELECT 1 FROM test'
      var parsed = shim.parseQuery(query)
      expect(parsed.operation).to.equal('select')
      expect(parsed.collection).to.equal('test')
      expect(parsed.raw).to.equal(query)
    })

    it('should allow for the parser to be set', function() {
      var testValue = false
      shim.setParser(function fakeParser(query) {
        expect(query).to.equal('foobar')
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.parseQuery('foobar')
      expect(testValue).to.be.true
    })

    it('should have constants to set the query parser with', function() {
      shim.agent.config.transaction_tracer.record_sql = 'raw'
      shim.setParser(shim.SQL_PARSER)
      var query = 'SELECT 1 FROM test'
      var parsed = shim.parseQuery(query)
      expect(parsed.operation).to.equal('select')
      expect(parsed.collection).to.equal('test')
      expect(parsed.raw).to.equal(query)
    })

    it('should not set parser to a new parser with invalid string', function() {
      var testValue = false
      shim.setParser(function fakeParser(query) {
        expect(query).to.equal('SELECT 1 FROM test')
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.setParser('bad string')
      var query = 'SELECT 1 FROM test'
      shim.parseQuery(query)
      expect(testValue).to.be.true
    })

    it('should not set parser to a new parser with an object', function() {
      var testValue = false
      shim.setParser(function fakeParser(query) {
        expect(query).to.equal('SELECT 1 FROM test')
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
      var query = 'SELECT 1 FROM test'
      shim.parseQuery(query)
      expect(testValue).to.be.true
    })
  })

  describe('#recordOperation', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordOperation(wrappable)
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordOperation(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordOperation(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordOperation(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordOperation(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      describe('when `record` is false', function() {
        it('should create a datastore operation segment but no metric', function() {
          shim.recordOperation(wrappable, 'getActiveSegment', {record: false})

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            var segment = wrappable.getActiveSegment()
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name).to.equal('getActiveSegment')
            expect(agent.tracer.getSegment()).to.equal(startingSegment)
          })
        })
      })

      describe('when `record` is true', function() {
        it('should create a datastore operation metric', function() {
          shim.recordOperation(wrappable, 'getActiveSegment')

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            var segment = wrappable.getActiveSegment()
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name)
              .to.equal('Datastore/operation/Cassandra/getActiveSegment')
            expect(agent.tracer.getSegment()).to.equal(startingSegment)
          })
        })
      })

      describe('when `record` is defaulted', function() {
        it('should create a datastore operation metric', function() {
          shim.recordOperation(wrappable, 'getActiveSegment')

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            var segment = wrappable.getActiveSegment()
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name)
              .to.equal('Datastore/operation/Cassandra/getActiveSegment')
            expect(agent.tracer.getSegment()).to.equal(startingSegment)
          })
        })
      })

      describe('when opaque false', () => {
        it('should create a child segment', () => {
          shim.recordOperation(wrappable, 'withNested', () => {
            return {name: 'test', opaque: false}
          })
          helper.runInTransaction(agent, (tx) => {
            const startingSegment = agent.tracer.getSegment()
            const segment = wrappable.withNested()
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name).to.equal('Datastore/operation/Cassandra/test')
            expect(segment.children).to.have.lengthOf(1)
            const childSegment = segment.children[0]
            expect(childSegment.name).to.equal('ChildSegment')
          })
        })
      })

      describe('when opaque true', () => {
        it('should not create a child segment', () => {
          shim.recordOperation(wrappable, 'withNested', () => {
            return {name: 'test', opaque: true}
          })
          helper.runInTransaction(agent, (tx) => {
            const startingSegment = agent.tracer.getSegment()
            const segment = wrappable.withNested()
            expect(segment).to.not.equal(startingSegment)
            expect(segment.name).to.equal('Datastore/operation/Cassandra/test')
            expect(segment.transaction).to.equal(tx)
            expect(segment.children).to.have.lengthOf(0)
          })
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordOperation(toWrap, {})

        helper.runInTransaction(agent, function() {
          expect(executed).to.be.false
          wrapped()
          expect(executed).to.be.true
        })
      })

      it('should invoke the spec in the context of the wrapped function', function() {
        var original = wrappable.bar
        var executed = false
        shim.recordOperation(wrappable, 'bar', function(_, fn, name, args) {
          executed = true
          expect(fn).to.equal(original)
          expect(name).to.equal('bar')
          expect(this).to.equal(wrappable)
          expect(args).to.deep.equal(['a', 'b', 'c'])

          return {}
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

        var wrapped = shim.recordOperation(toWrap, {callback: shim.LAST})

        helper.runInTransaction(agent, function() {
          wrapped(cb)
        })
      })

      describe('with `parameters`', function() {
        var localhost = null
        beforeEach(function() {
          localhost = getMetricHostName(agent, 'localhost')
          shim.recordOperation(wrappable, 'getActiveSegment', function(s, fn, n, args) {
            return {parameters: args[0]}
          })
        })

        function run(parameters, cb) {
          helper.runInTransaction(agent, function() {
            var segment = wrappable.getActiveSegment(parameters)
            cb(segment)
          })
        }

        it('should normalize the values of datastore instance attributes', function() {
          run({
            host: 'localhost',
            port_path_or_id: 1234,
            database_name: 'foobar'
          }, function(segment) {
            expect(segment).to.have.property('attributes')
            const attributes = segment.getAttributes()
            expect(attributes).to.have.property('host', localhost)
            expect(attributes).to.have.property('port_path_or_id', '1234')
            expect(attributes).to.have.property('database_name', 'foobar')
          })

          run({
            host: 'some_other_host',
            port_path_or_id: null,
            database_name: null
          }, function(segment) {
            expect(segment).to.have.property('attributes')
            const attributes = segment.getAttributes()
            expect(attributes).to.have.property('host', 'some_other_host')
            expect(attributes).to.have.property('port_path_or_id', 'unknown')
            expect(attributes).to.have.property('database_name', 'unknown')
          })
        })

        it('should remove `database_name` if disabled', function() {
          agent.config.datastore_tracer.database_name_reporting.enabled = false
          run({
            host: 'localhost',
            port_path_or_id: 1234,
            database_name: 'foobar'
          }, function(segment) {
            expect(segment).to.have.property('attributes')
            const attributes = segment.getAttributes()
            expect(attributes).to.have.property('host', localhost)
            expect(attributes).to.have.property('port_path_or_id', '1234')
            expect(attributes).to.not.have.property('database_name')
          })
        })

        it('should remove `host` and `port_path_or_id` if disabled', function() {
          agent.config.datastore_tracer.instance_reporting.enabled = false
          run({
            host: 'localhost',
            port_path_or_id: 1234,
            database_name: 'foobar'
          }, function(segment) {
            expect(segment).to.have.property('attributes')
            const attributes = segment.getAttributes()
            expect(attributes).to.not.have.property('host')
            expect(attributes).to.not.have.property('port_path_or_id')
            expect(attributes).to.have.property('database_name', 'foobar')
          })
        })
      })
    })

    describe('recorder', function() {
      beforeEach(function(done) {
        shim.recordOperation(wrappable, 'getActiveSegment', function() {
          return {
            name: 'op',
            parameters: {
              host: 'some_host',
              port_path_or_id: 1234,
              database_name: 'foobar'
            }
          }
        })
        helper.runInTransaction(agent, function(tx) {
          wrappable.getActiveSegment()
          tx.end()
          done()
        })
      })

      it('should create datastore metrics', function() {
        var metrics = getMetrics(agent).unscoped
        expect(metrics).to.have.property('Datastore/all')
        expect(metrics).to.have.property('Datastore/allWeb')
        expect(metrics).to.have.property('Datastore/Cassandra/all')
        expect(metrics).to.have.property('Datastore/Cassandra/allWeb')
        expect(metrics).to.have.property('Datastore/operation/Cassandra/op')
        expect(metrics).to.have.property('Datastore/instance/Cassandra/some_host/1234')
      })
    })
  })

  describe('#recordQuery', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordQuery(wrappable)
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordQuery(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordQuery(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordQuery(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordQuery(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      var query = null

      beforeEach(function() {
        query = 'SELECT property FROM my_table'
      })

      describe('when `record` is false', function() {
        it('should create a datastore query segment but no metric', function() {
          shim.recordQuery(wrappable, 'getActiveSegment', {
            query: shim.FIRST,
            record: false
          })

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            var segment = wrappable.getActiveSegment(query)
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name).to.equal('getActiveSegment')
            expect(agent.tracer.getSegment()).to.equal(startingSegment)
          })
        })
      })

      describe('when `record` is true', function() {
        it('should create a datastore query metric', function() {
          shim.recordQuery(wrappable, 'getActiveSegment', {query: shim.FIRST})

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            var segment = wrappable.getActiveSegment(query)
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name).to.equal('Datastore/statement/Cassandra/my_table/select')
            expect(agent.tracer.getSegment()).to.equal(startingSegment)
          })
        })
      })

      describe('when `record` is defaulted', function() {
        it('should create a datastore query metric', function() {
          shim.recordQuery(wrappable, 'getActiveSegment', {query: shim.FIRST})

          helper.runInTransaction(agent, function(tx) {
            var startingSegment = agent.tracer.getSegment()
            var segment = wrappable.getActiveSegment(query)
            expect(segment).to.not.equal(startingSegment)
            expect(segment.transaction).to.equal(tx)
            expect(segment.name).to.equal('Datastore/statement/Cassandra/my_table/select')
            expect(agent.tracer.getSegment()).to.equal(startingSegment)
          })
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordQuery(toWrap, {})

        helper.runInTransaction(agent, function() {
          expect(executed).to.be.false
          wrapped()
          expect(executed).to.be.true
        })
      })

      it('should allow after handlers to be specified', function() {
        var executed = false
        var toWrap = function() {}
        var wrapped = shim.recordQuery(toWrap, {
          query: function() {return 'test'},
          after: function() {
            executed = true
          }
        })

        helper.runInTransaction(agent, function() {
          expect(executed).to.be.false
          wrapped()
          expect(executed).to.be.true
        })
      })

      it('should bind the callback if there is one', function() {
        var cb = function() {}
        var toWrap = function(_query, wrappedCB) {
          expect(wrappedCB).to.not.equal(cb)
          expect(shim.isWrapped(wrappedCB)).to.be.true
          expect(shim.unwrap(wrappedCB)).to.equal(cb)

          expect(function() {
            wrappedCB()
          }).to.not.throw()
        }

        var wrapped = shim.recordQuery(toWrap, {
          query: shim.FIRST,
          callback: shim.LAST
        })

        helper.runInTransaction(agent, function() {
          wrapped(query, cb)
        })
      })

      it('should bind the row callback if there is one', function() {
        var cb = function() {}
        var toWrap = function(_query, wrappedCB) {
          expect(wrappedCB).to.not.equal(cb)
          expect(shim.isWrapped(wrappedCB)).to.be.true
          expect(shim.unwrap(wrappedCB)).to.equal(cb)

          expect(function() {
            wrappedCB()
          }).to.not.throw()
        }

        var wrapped = shim.recordQuery(toWrap, {
          query: shim.FIRST,
          rowCallback: shim.LAST
        })

        helper.runInTransaction(agent, function() {
          wrapped(query, cb)
        })
      })
    })
  })

  describe('#recordBatchQuery', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordBatchQuery(wrappable)
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordBatchQuery(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordBatchQuery(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordBatchQuery(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordBatchQuery(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      var query = null

      beforeEach(function() {
        query = 'SELECT property FROM my_table'
      })

      it('should create a datastore batch query metric', function() {
        shim.recordBatchQuery(wrappable, 'getActiveSegment', {query: shim.FIRST})

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          var segment = wrappable.getActiveSegment(query)
          expect(segment).to.not.equal(startingSegment)
          expect(segment.transaction).to.equal(tx)
          expect(segment.name)
            .to.equal('Datastore/statement/Cassandra/my_table/select/batch')
          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordBatchQuery(toWrap, {})

        expect(executed).to.be.false
        wrapped()
        expect(executed).to.be.true
      })
    })
  })

  describe('#parseQuery', function() {
    it('should parse a query string into a ParsedStatement', function() {
      var statement = shim.parseQuery('SELECT * FROM table')
      expect(statement).to.be.an.instanceof(ParsedStatement)
    })

    it('should strip enclosing special characters from collection', function() {
      expect(shim.parseQuery('select * from [table]').collection).to.equal('table')
      expect(shim.parseQuery('select * from {table}').collection).to.equal('table')
      expect(shim.parseQuery('select * from \'table\'').collection).to.equal('table')
      expect(shim.parseQuery('select * from "table"').collection).to.equal('table')
      expect(shim.parseQuery('select * from `table`').collection).to.equal('table')
    })
  })

  describe('#bindRowCallbackSegment', function() {
    it('should wrap the identified argument', function() {
      var args = [1, 2, wrappable.bar]
      shim.bindRowCallbackSegment(args, shim.LAST)

      expect(args[2]).to.not.equal(wrappable.bar)
      expect(shim.isWrapped(args[2])).to.be.true
      expect(shim.unwrap(args[2])).to.equal(wrappable.bar)
    })

    it('should not wrap if the index is invalid', function() {
      var args = [1, 2, wrappable.bar]

      expect(function() {
        shim.bindRowCallbackSegment(args, 50)
      }).to.not.throw()

      expect(args[2]).to.equal(wrappable.bar)
      expect(shim.isWrapped(args[2])).to.be.false
    })


    it('should not wrap the argument if it is not a function', function() {
      var args = [1, 2, wrappable.bar]

      expect(function() {
        shim.bindRowCallbackSegment(args, 1)
      }).to.not.throw()

      expect(args[1]).to.equal(2)
      expect(shim.isWrapped(args[1])).to.be.false
      expect(args[2]).to.equal(wrappable.bar)
      expect(shim.isWrapped(args[2])).to.be.false
    })

    it('should create a new segment on the first call', function() {
      helper.runInTransaction(agent, function() {
        var args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment
        var segment = shim.getSegment()
        var cbSegment = args[2]()
        expect(cbSegment).to.not.equal(segment)
        expect(segment.children).to.contain(cbSegment)
      })
    })

    it('should not create a new segment for calls after the first', function() {
      helper.runInTransaction(agent, function() {
        var args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment from the first call.
        var segment = shim.getSegment()
        var cbSegment = args[2]()
        expect(cbSegment).to.not.equal(segment)
        expect(segment.children).to.contain(cbSegment)
        expect(segment.children).to.have.length(1)

        // Call it a second time and see if we have the same segment.
        var cbSegment2 = args[2]()
        expect(cbSegment2).to.equal(cbSegment)
        expect(segment.children).to.have.length(1)
      })
    })

    it('should name the segment based on number of calls', function() {
      helper.runInTransaction(agent, function() {
        var args = [1, 2, wrappable.getActiveSegment]
        shim.bindRowCallbackSegment(args, shim.LAST)

        // Check the segment from the first call.
        var cbSegment = args[2]()
        expect(cbSegment).to.have.property('name')
          .match(/^Callback: getActiveSegment/)

        expect(cbSegment.getAttributes()).to.have.property('count', 1)

        // Call it a second time and see if the name changed.
        args[2]()
        expect(cbSegment.getAttributes()).to.have.property('count', 2)

        // And a third time, why not?
        args[2]()
        expect(cbSegment.getAttributes()).to.have.property('count', 3)
      })
    })
  })

  describe('#captureInstanceAttributes', function() {
    it('should not crash outside of a transaction', function() {
      expect(function() {
        shim.captureInstanceAttributes('foo', 123, 'bar')
      }).to.not.throw()
    })

    it('should not add parameters to segments it did not create', function() {
      var bound = agent.tracer.wrapFunction('foo', null, function(host, port, db) {
        shim.captureInstanceAttributes(host, port, db)
        return shim.getSegment()
      }, function(segment, args) {
        return args
      })

      helper.runInTransaction(agent, function() {
        var segment = bound('foobar', 123, 'bar')
        expect(segment).to.have.property('attributes')
        const attributes = segment.getAttributes()
        expect(attributes).to.not.have.property('host')
        expect(attributes).to.not.have.property('port_path_or_id')
        expect(attributes).to.not.have.property('database_name')
      })
    })

    it('should add normalized attributes to its own segments', function() {
      var wrapped = shim.recordOperation(function(host, port, db) {
        shim.captureInstanceAttributes(host, port, db)
        return shim.getSegment()
      })

      helper.runInTransaction(agent, function() {
        var segment = wrapped('foobar', 123, 'bar')
        expect(segment).to.have.property('attributes')
        const attributes = segment.getAttributes()
        expect(attributes).to.have.property('host', 'foobar')
        expect(attributes).to.have.property('port_path_or_id', '123')
        expect(attributes).to.have.property('database_name', 'bar')
      })
    })
  })

  describe('#getDatabaseNameFromUseQuery', () => {
    it('should match single statement use expressions', () => {
      expect(shim.getDatabaseNameFromUseQuery('use test_db;')).to.equal('test_db')
      expect(shim.getDatabaseNameFromUseQuery('USE INIT')).to.equal('INIT')
    })

    it('should not be sensitive to ; omission', () => {
      expect(shim.getDatabaseNameFromUseQuery('use test_db')).to.equal('test_db')
    })

    it('should not be sensitive to extra ;', () => {
      expect(shim.getDatabaseNameFromUseQuery('use test_db;;;;;;')).to.equal('test_db')
    })

    it('should not be sensitive to extra white space', () => {
      expect(shim.getDatabaseNameFromUseQuery('            use test_db;'))
        .to.equal('test_db')
      expect(shim.getDatabaseNameFromUseQuery('use             test_db;'))
        .to.equal('test_db')
      expect(shim.getDatabaseNameFromUseQuery('use test_db            ;'))
        .to.equal('test_db')
      expect(shim.getDatabaseNameFromUseQuery('use test_db;            '))
        .to.equal('test_db')
    })

    it('should match backtick expressions', () => {
      expect(shim.getDatabaseNameFromUseQuery('use `test_db`;')).to.equal('`test_db`')
      expect(shim.getDatabaseNameFromUseQuery('use `☃☃☃☃☃☃`;')).to.equal('`☃☃☃☃☃☃`')
    })

    it('should not match malformed use expressions', () => {
      expect(shim.getDatabaseNameFromUseQuery('use cxvozicjvzocixjv`oasidfjaosdfij`;'))
        .to.be.null
      expect(shim.getDatabaseNameFromUseQuery('use `oasidfjaosdfij`123;')).to.be.null
      expect(shim.getDatabaseNameFromUseQuery('use `oasidfjaosdfij` 123;')).to.be.null
      expect(shim.getDatabaseNameFromUseQuery('use \u0001;')).to.be.null
      expect(shim.getDatabaseNameFromUseQuery('use oasidfjaosdfij 123;')).to.be.null
    })
  })
})

function getMetrics(agent) {
  return agent.metrics._metrics
}
