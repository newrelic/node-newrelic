'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var recordGeneric = require('../../../lib/metrics/recorders/generic')
var Transaction = require('../../../lib/transaction')


function makeSegment(options) {
  var segment = options.transaction.trace.root.add('placeholder')
  segment.setDurationInMillis(options.duration)
  segment._setExclusiveDurationInMillis(options.exclusive)

  return segment
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT

  var segment     = makeSegment(options)
    , transaction = options.transaction


  transaction.setName(options.url, options.code)
  recordGeneric(segment, options.transaction.name)
}

describe('recordGeneric', function () {
  var agent
    , trans


  beforeEach(function () {
    agent = helper.loadMockedAgent()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  describe('when scope is undefined', function () {
    it('shouldn\'t crash on recording', function () {
      var segment = makeSegment({
        transaction : trans,
        duration : 0,
        exclusive : 0
      })
      expect(function () { recordGeneric(segment, undefined); }).not.throws()
    })

    it('should record no scoped metrics', function () {
      var segment = makeSegment({
        transaction : trans,
        duration : 5,
        exclusive : 5
      })
      recordGeneric(segment, undefined)

      var result = [
        [{name : 'placeholder'}, [1, 0.005, 0.005, 0.005, 0.005, 0.000025]]
      ]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  describe('with scope', function () {
    it('should record scoped metrics', function () {
      record({
        transaction : trans,
        url : '/test',
        code : 200,
        apdexT : 10,
        duration : 30,
        exclusive : 2,
      })

      var result = [
        [{name  : 'placeholder'},                   [1,0.030,0.002,0.030,0.030,0.000900]],
        [{name  : 'placeholder',
          scope : 'WebTransaction/NormalizedUri/*'},[1,0.030,0.002,0.030,0.030,0.000900]]
      ]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  it('should report exclusive time correctly', function () {
    var root   = trans.trace.root
    var parent = root.add('Test/Parent', recordGeneric)
    var child1 = parent.add('Test/Child/1', recordGeneric)
    var child2 = parent.add('Test/Child/2', recordGeneric)

    root.setDurationInMillis(30, 0)
    parent.setDurationInMillis(30, 0)
    child1.setDurationInMillis(12, 3)
    child2.setDurationInMillis(8, 17)

    var result = [
      [{name : 'Test/Parent'},  [1,0.030,0.010,0.030,0.030,0.000900]],
      [{name : 'Test/Child/1'}, [1,0.012,0.012,0.012,0.012,0.000144]],
      [{name : 'Test/Child/2'}, [1,0.008,0.008,0.008,0.008,0.000064]]
    ]

    trans.end(function() {
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })
})
