'use strict'

var helper = require('../../lib/agent_helper.js')
var chai = require('chai')
var assert = chai.assert
var sinon = require('sinon')
var Transaction = require('../../../lib/transaction')
var tests = require('../../lib/cross_agent_tests/cat/cat_map.json')
var cat = require('../../../lib/util/cat.js')
var NAMES = require('../../../lib/metrics/names.js')


function mockTransaction(agent, test, duration, cb) {
  var trans = new Transaction(agent)

  // non-CAT data
  trans.name = test.transactionName
  trans.id = test.transactionGuid
  trans.type = 'web'
  trans.baseSegment = {
    getDurationInMillis: function() {
      return trans.timer.getDurationInMillis()
    }
  }

  // CAT data
  if (test.inboundPayload) {
    cat.parsedHeadersToTrans(test.inboundPayload[0], test.inboundPayload, trans)
  } else {
    // Simulate the headers being unparsable or not existing
    cat.parsedHeadersToTrans(null, null, trans)
  }

  if (test.outboundRequests) {
    test.outboundRequests.forEach(function(req) {
      trans.pushPathHash(req.expectedOutboundPayload[3])
    })
  }

  trans.timer.begin()
  setTimeout(function() {
    trans.timer.end()
    cb(null, trans)
  }, duration)
}

describe('when CAT is disabled', function() {
  var agent

  before(function() {
    agent = helper.loadMockedAgent(null, {cross_application_tracer: {enabled: false}})
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  tests.forEach(function(test) {
    it(test.name + ' tx event should only contain non-CAT intrinsic attrs', function(done) {
      var start = Date.now()
      mockTransaction(agent, test, 20, function(err, trans) {
        var attrs = agent._addIntrinsicAttrsFromTransaction(trans)

        chai.expect(Object.keys(attrs)).to.have.members([
          'duration',
          'name',
          'timestamp',
          'type',
          'webDuration',
          'error'
        ])

        chai.expect(attrs.duration).to.be.within(0.015, 0.030)
        chai.expect(attrs.webDuration).to.be.within(0.015, 0.030)
        chai.expect(attrs.timestamp).to.be.within(start, start + 10)
        chai.expect(attrs.name).to.equal(test.transactionName)
        chai.expect(attrs.type).to.equal('Transaction')
        chai.expect(attrs.error).to.be.false

        done()
      })
    })
  })

  it('includes queueDuration', function() {
    var trans = new Transaction(agent)
    trans.measure(NAMES.QUEUETIME, null, 100)
    var attrs = agent._addIntrinsicAttrsFromTransaction(trans)
    assert.equal(attrs.queueDuration, 0.1)
  })

  it('includes externalDuration', function() {
    var trans = new Transaction(agent)
    trans.measure(NAMES.EXTERNAL.ALL, null, 100)
    var attrs = agent._addIntrinsicAttrsFromTransaction(trans)
    assert.equal(attrs.externalDuration, 0.1)
  })

  it('includes databaseDuration', function() {
    var trans = new Transaction(agent)
    trans.measure(NAMES.DB.ALL, null, 100)
    var attrs = agent._addIntrinsicAttrsFromTransaction(trans)
    assert.equal(attrs.databaseDuration, 0.1)
  })

  it('includes externalCallCount', function() {
    var trans = new Transaction(agent)
    trans.measure(NAMES.EXTERNAL.ALL, null, 100)
    trans.measure(NAMES.EXTERNAL.ALL, null, 100)
    var attrs = agent._addIntrinsicAttrsFromTransaction(trans)
    assert.equal(attrs.externalCallCount, 2)
  })

  it('includes databaseDuration', function() {
    var trans = new Transaction(agent)
    trans.measure(NAMES.DB.ALL, null, 100)
    trans.measure(NAMES.DB.ALL, null, 100)
    var attrs = agent._addIntrinsicAttrsFromTransaction(trans)
    assert.equal(attrs.databaseCallCount, 2)
  })

  it("should call transaction.hasErrors() for error attribute", function() {
    var trans = new Transaction(agent)
    var mock, attrs

    mock = sinon.mock(trans)
    mock.expects('hasErrors').returns(true)
    attrs = agent._addIntrinsicAttrsFromTransaction(trans)
    mock.verify()
    mock.restore()
    assert.equal(true, attrs.error)

    mock = sinon.mock(trans)
    mock.expects('hasErrors').returns(false)
    attrs = agent._addIntrinsicAttrsFromTransaction(trans)
    mock.verify()
    mock.restore()
    assert.equal(false, attrs.error)
  })
})

describe('when CAT is enabled', function() {
  var agent

  before(function() {
    // App name from test data
    agent = helper.loadMockedAgent(null, {
      apdex_t: 0.050,
      cross_application_tracer: {enabled: true}
    })
    agent.config.applications = function newFake() {
      return ['testAppName']
    }
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  var durations = [30, 150, 500]

  tests.forEach(function(test, index) {
    it(test.name + ' tx event should contain all intrinsic attrs', function(done) {
      var idx = index % durations.length
      var duration = durations[idx]

      var start = Date.now()
      mockTransaction(agent, test, duration, function(err, trans) {
        var attrs = agent._addIntrinsicAttrsFromTransaction(trans)

        var keys = [
          'duration',
          'name',
          'timestamp',
          'type',
          'webDuration',
          'error',
          'nr.guid',
          'nr.pathHash',
          'nr.referringPathHash',
          'nr.tripId',
          'nr.referringTransactionGuid',
          'nr.alternatePathHashes',
          'nr.apdexPerfZone'
        ]
        for (var i = 0; i < test.nonExpectedIntrinsicFields.length; ++i) {
          keys.splice(keys.indexOf(test.nonExpectedIntrinsicFields[i]), 1)
        }
        if (!test.expectedIntrinsicFields['nr.pathHash']) {
          keys.splice(keys.indexOf('nr.apdexPerfZone'), 1)
        }

        chai.expect(Object.keys(attrs)).to.have.members(keys)

        var min = (duration - 5) / 1000
        var max = (duration + 10) / 1000
        chai.expect(attrs.duration).to.be.within(min, max)
        chai.expect(attrs.webDuration).to.be.within(min, max)
        chai.expect(attrs.timestamp).to.be.within(start, start + 10)
        chai.expect(attrs.name).to.equal(test.transactionName)
        chai.expect(attrs.type).to.equal('Transaction')
        chai.expect(attrs.error).to.be.false
        chai.expect(attrs['nr.guid'])
          .to.equal(test.expectedIntrinsicFields['nr.guid'])
        chai.expect(attrs['nr.pathHash'])
          .to.equal(test.expectedIntrinsicFields['nr.pathHash'])
        chai.expect(attrs['nr.referringPathHash'])
          .to.equal(test.expectedIntrinsicFields['nr.referringPathHash'])
        chai.expect(attrs['nr.tripId'])
          .to.equal(test.expectedIntrinsicFields['nr.tripId'])
        chai.expect(attrs['nr.referringTransactionGuid'])
          .to.equal(test.expectedIntrinsicFields['nr.referringTransactionGuid'])
        chai.expect(attrs['nr.alternatePathHashes'])
          .to.equal(test.expectedIntrinsicFields['nr.alternatePathHashes'])

        if (test.expectedIntrinsicFields['nr.pathHash']) {
          // nr.apdexPerfZone not specified in the test, this is used to exercise it.
          switch (idx) {
            case 0:
              chai.expect(attrs['nr.apdexPerfZone']).to.equal('S')
              break
            case 1:
              chai.expect(attrs['nr.apdexPerfZone']).to.equal('T')
              break
            case 2:
              chai.expect(attrs['nr.apdexPerfZone']).to.equal('F')
              break
          }
        }

        done()
      })
    })
  })
})
