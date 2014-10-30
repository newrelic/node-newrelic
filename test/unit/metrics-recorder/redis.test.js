'use strict'

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , helper      = require('../../lib/agent_helper.js')
  , recordRedis = require('../../../lib/metrics/recorders/redis.js')
  , Transaction = require('../../../lib/transaction')


function makeSegment(options) {
  var segment = options.transaction.getTrace().root.add('Datastore/operation/Redis/set')
  segment.setDurationInMillis(options.duration)
  segment._setExclusiveDurationInMillis(options.exclusive)
  segment.host = '127.0.0.1'
  segment.port = 6379

  return segment
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT

  var segment     = makeSegment(options)
    , transaction = options.transaction


  transaction.setName(options.url, options.code)
  recordRedis(segment, options.transaction.name)
}

describe("recordRedis", function () {
  var agent
    , trans


  beforeEach(function () {
    agent = helper.loadMockedAgent()
    // here to test that the backstop override is working as expected
    agent.config.enforce_backstop = false
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
      expect(function () { recordRedis(segment, undefined); }).not.throws()
    })

    it("should record no scoped metrics", function () {
      recordRedis(segment, undefined)

      var result = [
        [{name : "Datastore/operation/Redis/set"},           [1,0,0,0,0,0]],
        [{name : "Datastore/allOther"},                      [1,0,0,0,0,0]],
        [{name : "Datastore/all"},                           [1,0,0,0,0,0]],
        [{name : "Datastore/instance/Redis/127.0.0.1:6379"}, [1,0,0,0,0,0]]
      ]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  describe("with scope", function () {
    it("should record scoped metrics", function () {
      record({
        transaction : trans,
        url         : '/test',
        code        : 200,
        apdexT      : 10,
        duration    : 30,
        exclusive   : 2,
      })

      var result = [
        [{name  : "Datastore/operation/Redis/set"},
         [1,0.030,0.002,0.030,0.030,0.000900]],
        [{name  : "Datastore/allWeb"},
         [1,0.030,0.002,0.030,0.030,0.000900]],
        [{name  : "Datastore/all"},
         [1,0.030,0.002,0.030,0.030,0.000900]],
        [{name  : "Datastore/instance/Redis/127.0.0.1:6379"},
         [1,0.030,0.002,0.030,0.030,0.000900]],
        [{name  : "Datastore/operation/Redis/set", scope : "WebTransaction/Uri/test"},
         [1,0.030,0.002,0.030,0.030,0.000900]]
      ]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  it("should report exclusive time correctly", function () {
    var root   = trans.getTrace().root
      , parent = root.add('Datastore/operation/Redis/ladd',     recordRedis)
      , child1 = parent.add('Datastore/operation/Redis/blpopr', recordRedis)
      , child2 = child1.add('Datastore/operation/Redis/lpop',   recordRedis)


    root.setDurationInMillis(  32,  0)
    parent.setDurationInMillis(32,  0)
    child1.setDurationInMillis(16, 11)
    child2.setDurationInMillis( 5,  2)


    var result = [
      [{name : "Datastore/operation/Redis/ladd"},   [1,0.032,0.011,0.032,0.032,0.001024]],
      [{name : "Datastore/allOther"},               [3,0.053,0.027,0.005,0.032,0.001305]],
      [{name : "Datastore/all"},                    [3,0.053,0.027,0.005,0.032,0.001305]],
      [{name : "Datastore/operation/Redis/blpopr"}, [1,0.016,0.011,0.016,0.016,0.000256]],
      [{name : "Datastore/operation/Redis/lpop"},   [1,0.005,0.005,0.005,0.005,0.000025]]
    ]

    trans.end(function() {
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })
})
