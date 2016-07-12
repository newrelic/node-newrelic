'use strict'

var helper = require('../lib/agent_helper')
var shims = require('../../lib/shim')
var tap = require('tap')

function MockModule() {
  this.name = 'MockModule'
}
MockModule.prototype.queryMethod = function (query, cb) {
  this.internalMethod(query, function queryMethodCb(result) {
    cb(result)
  })
}
MockModule.prototype.internalMethod = function(query, cb) {
  var result = 42
  cb(result)
}
MockModule.prototype.queryMethod2 = function (query, cb) {
  this.internalMethod2(query, function queryMethodCb2(result) {
    cb(result)
  })
}
MockModule.prototype.internalMethod2 = function(query, cb) {
  var result = 'banana'
  cb(result)
}

function initialize(agent, module, moduleName, shim) {
  var proto = module.prototype

  shim.setDatastore('MockModule')
  shim.setParser(function(query) {
    var parts = query.split('/')
    return {
      operation: parts[0],
      model: 'model',
      query: parts[2]
    }
  })
  shim.recordQuery(proto, 'internalMethod', {query: shim.FIRST, callback: shim.LAST})
  shim.recordQuery(proto, 'queryMethod', {query: shim.FIRST, callback: shim.LAST})
  shim.recordQuery(proto, 'internalMethod2', {query: shim.FIRST, callback: shim.LAST})
  shim.recordQuery(proto, 'queryMethod2', {query: shim.FIRST, callback: shim.LAST})
}

tap.test("check internal segment filtering", function (t) {
  var agent = helper.loadMockedAgent()

  var shim = new shims.DatastoreShim(agent, 'MockModule', 'MockModule')
  initialize(agent, MockModule, 'MockModule', shim)

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  helper.runInTransaction(agent, function(transaction) {
    var mockModule = new MockModule()
    mockModule.queryMethod('meaning/of/life', function myQueryCb(result) {
      t.equal(result, 42, 'query response is correct')
      mockModule.queryMethod2('who/am/i', function myQueryCb2(result) {
        t.equal(result, 'banana', 'query response is correct')
      })
    })

    var seg1 = transaction.trace.root.children[0]
    t.equal(seg1.name, 'Datastore/statement/MockModule/model/meaning', 'correct segment')
    var seg2 = seg1.children[0]
    t.equal(seg2.name, 'Callback: myQueryCb', 'correct callback')
    var seg3 = seg2.children[0]
    t.equal(seg3.name, 'Datastore/statement/MockModule/model/who', 'correct segment')
    var seg4 = seg3.children[0]
    t.equal(seg4.name, 'Callback: myQueryCb2', 'correct callback')

    t.end()
  })
})
