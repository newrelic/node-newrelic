'use strict'

var path   = require('path')
var chai   = require('chai')
var expect = chai.expect
var should = chai.should()
var helper = require('../../lib/agent_helper')
var DatastoreShim = require('../../../lib/shim/datastore-shim')

describe('agent instrumentation of MongoDB', function () {
  var shim

  describe('shouldn\'t cause bootstrapping to fail', function () {
    var agent
    var initialize

    before(function () {
      agent = helper.loadMockedAgent()
      shim = new DatastoreShim(agent, 'mongodb')
      initialize = require('../../../lib/instrumentation/mongodb')
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('when passed no module', function () {
      expect(function () { initialize(agent, null, 'mongodb', shim); }).not.throws()
    })

    it('when passed an empty module', function () {
      expect(function () { initialize(agent, {}, 'mongodb', shim); }).not.throws()
    })
  })

  describe('when capturing terms is disabled', function () {
    var agent
    var segment
    var terms


    before(function (done) {
      function StubCollection () {
        this.s = {topology: {host: 'localhost', port:12345}}
      }

      StubCollection.prototype.findAndModify = function findAndModify(terms, options, callback) {
        this.terms = terms
        this.options = options
        process.nextTick(function cb_nextTick() { callback(null, 1); })
      }

      var mockodb    = {Collection : StubCollection}
      var collection = new mockodb.Collection('test')
      var initialize = require('../../../lib/instrumentation/mongodb')


      agent = helper.loadMockedAgent()
      shim = new DatastoreShim(agent, 'mongodb')

      initialize(agent, mockodb, 'mockodb', shim)

      helper.runInTransaction(agent, function (trans) {
        collection.findAndModify({val : 'hi'}, {w : 333}, function () {
          process.nextTick(function cb_nextTick() {
            // need to generate the trace so exclusive times are added to segment parameters
            trans.trace.generateJSON(function cb_generateJSON() {
              terms = collection.terms
              segment = trans.trace.root.children[0]
              done()
            })
          })
        })
      })
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('shouldn\'t modify query terms', function () {
      should.not.exist(terms.nr_exclusive_duration_millis)
    })

    it('shouldn\'t copy query terms onto segment parameters', function () {
      should.not.exist(segment.parameters.val)
    })

    it('should capture host and port', function () {
      expect(segment.host).equals('localhost')
      expect(segment.port).equals(12345)
    })
  })

  describe('when capturing terms is enabled', function () {
    var agent
    var segment
    var terms


    before(function (done) {
      function StubCollection () {
        this.s = {topology: {host: 'localhost', port:12345}}
      }

      StubCollection.prototype.findAndModify = function findAndModify(terms, options, callback) {
        this.terms = terms
        this.options = options
        process.nextTick(function cb_nextTick() { callback(null, 1); })
      }

      var mockodb    = {Collection : StubCollection}
      var collection = new mockodb.Collection('test')
      var initialize = require('../../../lib/instrumentation/mongodb')


      agent = helper.loadMockedAgent()
      shim = new DatastoreShim(agent, 'mongodb')
      agent.config.capture_params = true
      agent.config.ignored_params = ['other']

      initialize(agent, mockodb, 'mockodb', shim)

      helper.runInTransaction(agent, function (trans) {
        collection.findAndModify({val : 'hi', other : 'bye'}, {w : 333}, function () {
          process.nextTick(function cb_nextTick() {
            // need to generate the trace so exclusive times are added to segment parameters
            trans.trace.generateJSON(function cb_generateJSON() {
              terms = collection.terms
              segment = trans.trace.root.children[0]

              done()
            })
          })
        })
      })
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('shouldn\'t modify query terms', function () {
      should.not.exist(terms.nr_exclusive_duration_millis)
    })

    it('should respect ignored parameter list', function () {
      should.not.exist(segment.parameters.other)
    })

    it('should capture host and port', function () {
      expect(segment.host).equals('localhost')
      expect(segment.port).equals(12345)
    })
  })

  describe('with child MongoDB operations', function () {
    var agent
    var transaction
    var collection
    var error
    var removed


    before(function (done) {
      function StubCollection (name) {
        this.collectionName = name
      }

      StubCollection.prototype.findAndRemove = function findAndRemove(terms, options, callback) {
        this.findAndModify(terms, options, callback)
      }

      StubCollection.prototype.findAndModify = function findAndModify(terms, options, callback) {
        this.terms = terms
        this.options = options
        process.nextTick(function cb_nextTick() {
          callback(null, 1)
        })
      }

      var mockodb = {Collection : StubCollection}

      agent = helper.loadMockedAgent()
      shim = new DatastoreShim(agent, 'mongodb')

      var initialize = require('../../../lib/instrumentation/mongodb')
      initialize(agent, mockodb, 'mockodb', shim)

      collection = new mockodb.Collection('test')

      helper.runInTransaction(agent, function (trans) {
        transaction = trans
        collection.findAndRemove({val : 'hi'}, {w : 333}, function (err, rem) {
          error = err
          removed = rem

          done()
        })
      })
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should have left the query terms alone', function () {
      expect(collection.terms).eql({val : 'hi'})
    })

    it('should have left the query options alone', function () {
      expect(collection.options).eql({w : 333})
    })

    it('shouldn\'t have messed with the error parameter', function () {
      should.not.exist(error)
    })

    it('shouldn\'t have messed with the result parameter', function () {
      expect(removed).equal(1)
    })

    it('should have only one segment (the parent) under the trace root', function () {
      var root = transaction.trace.root
      expect(root.children.length).equal(1)
    })

    it('should have recorded the findAndRemove operation', function () {
      var root   = transaction.trace.root
      var parent = root.children[0]


      expect(parent.name).equal('Datastore/statement/MongoDB/test/findAndRemove')
    })

    it('should have no child segments under the parent', function () {
      var root   = transaction.trace.root
      var parent = root.children[0]

      expect(parent.children.length).equal(1)
    })

    it('its callback segment should have no child segments', function () {
      var root = transaction.trace.root
      var parent = root.children[0]
      var cb = parent.children[0]

      expect(cb.children.length).equal(0)
    })

    it('should have gathered metrics', function () {
      var metrics = transaction.metrics
      should.exist(metrics)
    })

    it('should have recorded only one database call', function () {
      var metrics = transaction.metrics
      transaction.end(function() {
        expect(metrics.getMetric('Datastore/all').callCount).equal(1)
      })
    })

    it('should have that call be the findAndRemove', function () {
      var metrics = transaction.metrics
      var metric  = metrics.getMetric('Datastore/statement/MongoDB/test/findAndRemove')


      should.exist(metric)
      expect(metric.callCount).equal(1)
    })
  })

  describe('with Grid operations', function(){
    var agent
    var segment

    before(function (done) {
      function StubGrid () {}

      StubGrid.prototype.get = function get(id, callback) {
        this.id = id
        process.nextTick(function cb_nextTick() { callback(null, 1); })
      }

      var mockodb    = {Grid : StubGrid}
      var grid = new mockodb.Grid('test')
      var initialize = require('../../../lib/instrumentation/mongodb')


      agent = helper.loadMockedAgent()
      shim = new DatastoreShim(agent, 'mongodb')

      initialize(agent, mockodb, 'mockodb', shim)

      helper.runInTransaction(agent, function (trans) {
        grid.get(123, function () {
          process.nextTick(function cb_nextTick() {
            // need to generate the trace so exclusive times are added to segment parameters
            trans.trace.generateJSON(function cb_generateJSON() {
              segment = trans.trace.root.children[0]
              done()
            })
          })
        })
      })
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should have correct segment name', function () {
      expect(segment.name).equals('Datastore/operation/MongoDB/GridFS-get')
    })
  })

  describe('when using APM API', function(){
    var agent
    var grid
    var collection
    var db

    before(function (done) {
      var instrumentations = [
        {
          name: "Gridstore",
          obj: StubGrid,
          instrumentations: [
            {
              methods: [
                "getc"
              ],
              options: {
                callback: true
              }
            }
          ]
        },
        {
          name: "Collection",
          obj: StubCollection,
          instrumentations: [
            {
              methods: [
                "find"
              ],
              options: {
                callback: true
              }
            }
          ]
        },
        {
          name: "Cursor",
          obj: StubCursor,
          instrumentations: [
            {
              methods: [
                "each"
              ],
              options: {
                callback: true
              }
            }
          ]
        },
        {
          name: "Db",
          obj: StubDb,
          instrumentations: [
            {
              methods: [
                "command"
              ],
              options: {
                callback: true
              }
            }
          ]
        }
      ]

      function mongoInstrument (options, instrumentFunc) {
        instrumentFunc(null, instrumentations)
      }
      function StubGrid () {}
      function StubCollection () { this.collectionName = 'test' }
      function StubCursor () { this.items = [] }
      function StubDb () {}

      StubGrid.prototype.getc = function getc(callback) {
        process.nextTick(function cb_nextTick() { callback(null, 1); })
      }

      StubCollection.prototype.find = function find(query) {
        var cursor = new StubCursor()
        cursor.items = [1, 2]
        return cursor
      }

      StubCursor.prototype.each = function each(callback) {
        this._each(callback)
      }

      StubCursor.prototype._each = function _each(callback) {
        var self = this
        process.nextTick(function cb_nextTick() {
          // debugger
          if (self.items.length === 0) return
          callback(null, self.items.pop())
          _each(callback)
        })
      }

      StubDb.prototype.command = function command(command, options, callback) {
        process.nextTick(function cb_nextTick() { callback(null, 1); })
      }

      var mockodb = {
        instrument : mongoInstrument,
        GridStore: StubGrid,
        Collection: StubCollection,
        Cursor: StubCursor,
        Db: StubDb
      }

      grid = new mockodb.GridStore()
      collection = new mockodb.Collection()
      db = new mockodb.Db()
      var initialize = require('../../../lib/instrumentation/mongodb')


      agent = helper.loadMockedAgent()
      shim = new DatastoreShim(agent, 'mongodb')

      initialize(agent, mockodb, 'mockodb', shim)
      done()
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should have the correct trace for Db ops', function() {
      helper.runInTransaction(agent, function (trans) {
        db.command({ping:1}, null, function (err, result) {
          process.nextTick(function cb_nextTick() {
            // need to generate the trace so exclusive times are added to segment parameters
            trans.trace.generateJSON(function cb_generateJSON() {
              var segment = trans.trace.root.children[0]
              expect(segment.name).equals('Datastore/operation/MongoDB/command')
              expect(segment.children.length).equals(1)
              expect(segment.children[0].name).equals('Callback: <anonymous>')
            })
          })
        })
      })
    })

    it('should have the correct trace for Grid ops', function() {
      helper.runInTransaction(agent, function (trans) {
        grid.getc(function (err, chr) {
          process.nextTick(function cb_nextTick() {
            // need to generate the trace so exclusive times are added to segment parameters
            trans.trace.generateJSON(function cb_generateJSON() {
              var segment = trans.trace.root.children[0]
              expect(segment.name).equals('Datastore/operation/MongoDB/GridFS-getc')
              expect(segment.children.length).equals(1)
              expect(segment.children[0].name).equals('Callback: <anonymous>')
            })
          })
        })
      })
    })

    it('should have the correct trace for Collection and Cursor querues', function() {
      helper.runInTransaction(agent, function (trans) {
        var cursor = collection.find()
        cursor.each(function (err, item) {
          process.nextTick(function cb_nextTick() {
            // need to generate the trace so exclusive times are added to segment parameters
            trans.trace.generateJSON(function cb_generateJSON() {
              var root = trans.trace.root
              expect(root.children.length).equals(2)
              expect(root.children[0].name).equals('Datastore/statement/MongoDB/test/find')
              expect(root.children[1].name).equals('Datastore/statement/MongoDB/unknown/each')
              expect(root.children[1].children.length).equals(0, '"each" should have no child segments')
            })
          })
        })
      })
    })
  })
})
