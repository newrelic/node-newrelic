'use strict'

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , helper      = require('../../lib/agent_helper')
  , recordWeb   = require('../../../lib/metrics/recorders/http')
  , Transaction = require('../../../lib/transaction')
  

function makeSegment(options) {
  var segment = options.transaction.getTrace().root.add('placeholder')
  segment.setDurationInMillis(options.duration)
  segment._setExclusiveDurationInMillis(options.exclusive)

  return segment
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT

  var segment     = makeSegment(options)
    , transaction = options.transaction
    

  transaction.setName(options.url, options.code)
  transaction.queueTime = options.queueTime
  segment.markAsWeb(options.url)
  recordWeb(segment, options.transaction.name)
}

describe("when recording queueTime", function () {
  var agent
    , trans
    

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("non zero times should record a metric", function () {
    record({
      transaction : trans,
      apdexT      : 0.2,
      url         : '/test',
      code        : 200,
      duration    : 1,
      exclusive   : 1,
      queueTime   : 2200,
    })

    var result = [
      [{name  : 'WebTransaction'},                 [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{name  : 'HttpDispatcher'},                 [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{name  : 'WebTransaction/NormalizedUri/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{name  : 'WebFrontend/QueueTime'},          [1,2.2,2.2,2.2,2.2,4.840000000000001]],
      [{name  : 'Apdex/NormalizedUri/*'},          [1,     0,     0,   0.2,   0.2,        0]],
      [{name  : 'Apdex'},                          [1,     0,     0,   0.2,   0.2,        0]],
      [{name  : 'WebTransaction/NormalizedUri/*',
        scope : 'WebTransaction/NormalizedUri/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
    ]
    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
  })

  it("zero times should not record a metric", function () {
    record({
      transaction : trans,
      apdexT      : 0.2,
      url         : '/test',
      code        : 200,
      duration    : 1,
      exclusive   : 1,
      queueTime   : 0,
    })

    var result = [
      [{name  : 'WebTransaction'},                 [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{name  : 'HttpDispatcher'},                 [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{name  : 'WebTransaction/NormalizedUri/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{name  : 'Apdex/NormalizedUri/*'},          [1,     0,     0,   0.2,   0.2,        0]],
      [{name  : 'Apdex'},                          [1,     0,     0,   0.2,   0.2,        0]],
      [{name  : 'WebTransaction/NormalizedUri/*',
        scope : 'WebTransaction/NormalizedUri/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
    ]
    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
  })
})
