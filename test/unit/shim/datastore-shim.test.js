'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')
var DatastoreShim = require('../../../lib/shim/datastore-shim')
var ParsedStatement = require('../../../lib/db/parsed-statement')

describe('DatastoreShim', function() {
  var agent = null
  var shim = null
  var wrappable = null

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    shim = new DatastoreShim(agent, 'test-cassandra', DatastoreShim.CASSANDRA)
    wrappable = {
      name: 'this is a name',
      bar: function barsName() { return 'bar' },
      fiz: function fizsName() { return 'fiz' },
      anony: function() {},
      getActiveSegment: function() {
        return agent.tracer.getSegment()
      }
    }
  })

  afterEach(function () {
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
      expect(function() { new DatastoreShim() })
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })

    it('should require the `moduleName` parameter', function() {
      expect(function() { new DatastoreShim(agent) })
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
      var datastores = ['CASSANDRA', 'MYSQL', 'REDIS']
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
      var query = 'SELECT 1 FROM test'
      var parsed = shim.parseQuery(query)
      expect(parsed.operation).to.equal('select')
      expect(parsed.model).to.equal('test')
      expect(parsed.raw).to.equal(query)
    })

    it('should allow for the parser to be set', function() {
      var testValue = false
      shim.setParser(function fakeParser(query) {
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.parseQuery()
      expect(testValue).to.be.true
    })

    it('should have constants to set the query parser with', function() {
      shim.setParser(shim.SQL_PARSER)
      var query = 'SELECT 1 FROM test'
      var parsed = shim.parseQuery(query)
      expect(parsed.operation).to.equal('select')
      expect(parsed.model).to.equal('test')
      expect(parsed.raw).to.equal(query)
    })

    it('should not set parser to a new parser with invalid string', function() {
      var testValue = false
      shim.setParser(function fakeParser(query) {
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.setParser('bad string')
      var query = 'SELECT 1 FROM test'
      var parsed = shim.parseQuery(query)
      expect(testValue).to.be.true
    })

    it('should not set parser to a new parser with an object', function() {
      var testValue = false
      shim.setParser(function fakeParser(query) {
        testValue = true
        return {
          operation: 'test'
        }
      })
      shim.setParser({
        parser: function shouldNotBeCalled(){
          throw new Error('get me outta here')
        }
      })
      var query = 'SELECT 1 FROM test'
      var parsed = shim.parseQuery(query)
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
      it('should create a datastore operation metric', function() {
        shim.recordOperation(wrappable, 'getActiveSegment')

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          var segment = wrappable.getActiveSegment()
          expect(segment).to.not.equal(startingSegment)
          expect(segment.name).to.equal('Datastore/operation/Cassandra/getActiveSegment')
          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordOperation(toWrap, {})

        expect(executed).to.be.false
        wrapped()
        expect(executed).to.be.true
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

        wrappable.bar('a', 'b', 'c')
        expect(executed).to.be.true
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
        wrapped(cb)
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

      it('should create a datastore query metric', function() {
        shim.recordQuery(wrappable, 'getActiveSegment', {query: shim.FIRST})

        helper.runInTransaction(agent, function(tx) {
          var startingSegment = agent.tracer.getSegment()
          var segment = wrappable.getActiveSegment(query)
          expect(segment).to.not.equal(startingSegment)
          expect(segment.name).to.equal('Datastore/statement/Cassandra/my_table/select')
          expect(agent.tracer.getSegment()).to.equal(startingSegment)
        })
      })

      it('should execute the wrapped function', function() {
        var executed = false
        var toWrap = function() { executed = true }
        var wrapped = shim.recordQuery(toWrap, {})

        expect(executed).to.be.false
        wrapped()
        expect(executed).to.be.true
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
          expect(segment.name).to.equal('Datastore/statement/Cassandra/my_table/select/batch')
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
  })
})
