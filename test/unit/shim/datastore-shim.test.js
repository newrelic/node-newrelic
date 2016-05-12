'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')
var DatastoreShim = require('../../../lib/shim/datastore-shim')

describe('DatastoreShim', function() {
  var agent = null
  var shim = null
  var wrappable = null

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    shim = new DatastoreShim(agent, DatastoreShim.CASSANDRA)
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
        .to.throw(Error, 'Shim must be initialized with an agent.')
    })

    it('should take an optional `datastoreId`', function() {
      // Test without datastoreId
      expect(function() {
        new DatastoreShim(agent)
      }).to.not.throw()

      // Use one provided for all tests to check constructed with datastoreId
      expect(shim).to.have.property('_datastoreId', DatastoreShim.CASSANDRA)
      expect(shim).to.have.property('_metrics')
    })
  })

  describe('well-known datastores', function() {
    it('should be enumerated on the class and prototype', function() {
      var datastores = ['CASSANDRA', 'REDIS']
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
      shim = new DatastoreShim(agent)
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

  describe('#recordOperation', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.record(wrappable, function() {})
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    it('should invoke the spec in the context of the wrapped function')

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given')
      it('should wrap the first parameter if `null` is given for properties')
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object')
      it('should mark wrapped properties as such')
      it('should not mark unwrapped properties as wrapped')
    })

    describe('wrapper', function() {
      it('should create a datastore operation metric')
      it('should execute the wrapped function')
    })
  })

  describe('#recordQuery', function() {
    it('should not wrap non-function objects')
    it('should invoke the spec in the context of the wrapped function')

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given')
      it('should wrap the first parameter if `null` is given for properties')
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object')
      it('should mark wrapped properties as such')
      it('should not mark unwrapped properties as wrapped')
    })

    describe('wrapper', function() {
      it('should create a datastore query metric')
      it('should execute the wrapped function')
    })
  })

  describe('#recordBatchQuery', function() {
    it('should not wrap non-function objects')
    it('should invoke the spec in the context of the wrapped function')

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given')
      it('should wrap the first parameter if `null` is given for properties')
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object')
      it('should mark wrapped properties as such')
      it('should not mark unwrapped properties as wrapped')
    })

    describe('wrapper', function() {
      it('should create a datastore batch query metric')
      it('should execute the wrapped function')
    })
  })

  describe('#parseQuery', function() {
    it('should parse a query string into a ParsedStatement')
  })
})
