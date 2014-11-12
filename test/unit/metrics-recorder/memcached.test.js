'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper.js')
var recordMemcache = require('../../../lib/metrics/recorders/memcached.js')
var Transaction = require('../../../lib/transaction')


function makeSegment(options) {
  var segment = options.transaction.trace.root
                  .add('Datastore/operation/Memcache/set')
  segment.setDurationInMillis(options.duration)
  segment._setExclusiveDurationInMillis(options.exclusive)
  segment.host = 'localhost'
  segment.port = 11211

  return segment
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT

  var segment = makeSegment(options)
  var transaction = options.transaction


  transaction.setName(options.url, options.code)
  recordMemcache(segment, options.transaction.name)
}

describe("recordMemcached", function () {
  var agent
  var trans


  beforeEach(function () {
    agent = helper.loadMockedAgent()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  describe("when scope is undefined", function () {
    var segment

    beforeEach(function () {
      segment = makeSegment({
        transaction : trans,
        duration : 0,
        exclusive : 0
      })
    })

    it("shouldn't crash on recording", function () {
      expect(function () { recordMemcache(segment, undefined); }).not.throws()
    })

    it("should record no scoped metrics", function () {
      recordMemcache(segment, undefined)

      var result = [
        [{name: 'Datastore/operation/Memcache/set'},[1, 0, 0, 0, 0, 0]],
        [{name: 'Datastore/allOther'},[1, 0, 0, 0, 0, 0]],
        [{name: 'Datastore/Memcache/allOther'},[1, 0, 0, 0, 0, 0]],
        [{name: 'Datastore/all'},[1, 0, 0, 0, 0, 0]],
        [{name: 'Datastore/Memcache/all'},[1, 0, 0, 0, 0, 0]]
      ]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  describe("with scope", function () {
    it("should record scoped metrics", function () {
      record({
        transaction : trans,
        url : '/test',
        code : 200,
        apdexT : 10,
        duration : 30,
        exclusive : 2,
      })

      var result = [
        [{name: 'Datastore/operation/Memcache/set'}, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
        [{name: 'Datastore/allWeb'}, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
        [{name: 'Datastore/Memcache/allWeb'}, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
        [{name: 'Datastore/all'}, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
        [{name: 'Datastore/Memcache/all'}, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
        [
          {
            name: 'Datastore/operation/Memcache/set',
            scope: 'WebTransaction/NormalizedUri/*'
          },
          [1, 0.03, 0.002, 0.03, 0.03, 0.0009]
        ]
      ]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  it("should report exclusive time correctly", function () {
    var root   = trans.trace.root
      , parent = root.add('Datastore/operation/Memcache/get',     recordMemcache)
      , child1 = parent.add('Datastore/operation/Memcache/set',   recordMemcache)
      , child2 = parent.add('Datastore/operation/Memcache/clear', recordMemcache)


    root.setDurationInMillis(  32,  0)
    parent.setDurationInMillis(32,  0)
    child1.setDurationInMillis(15, 10)
    child2.setDurationInMillis( 2,  1)

    var result = [[
        {name: 'Datastore/operation/Memcache/get'},
        [1, 0.032, 0.015, 0.032, 0.032, 0.001024]
      ], [
        {name: 'Datastore/allOther'},
        [3, 0.049, 0.032, 0.002, 0.032, 0.001253]
      ], [
        {name: 'Datastore/Memcache/allOther'},
        [3, 0.049, 0.032, 0.002, 0.032, 0.001253]
      ], [
        {name: 'Datastore/all'},
        [3, 0.049, 0.032, 0.002, 0.032, 0.001253]
      ], [
        {name: 'Datastore/Memcache/all'},
        [3, 0.049, 0.032, 0.002, 0.032, 0.001253]
      ], [
        {name: 'Datastore/operation/Memcache/set'},
        [1, 0.015, 0.015, 0.015, 0.015, 0.000225]
      ], [
        {name: 'Datastore/operation/Memcache/clear'},
        [1, 0.002, 0.002, 0.002, 0.002, 0.000004]
      ]]

    trans.end(function(){
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })
})
