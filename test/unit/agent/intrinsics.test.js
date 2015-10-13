'use strict'
/*jshint expr:true*/

var helper = require('../../lib/agent_helper.js')
var chai = require('chai')
var assert = chai.assert
var sinon = require('sinon')
var Transaction = require('../../../lib/transaction')
var tests = require('../../lib/cross_agent_tests/cat/cat_map.json')
var cat = require('../../../lib/util/cat.js')


function mockTransaction(agent, test, duration) {
  var trans = new Transaction(agent)

  // non-CAT data
  trans.name = test.transactionName
  trans.timer.duration = duration
  trans.timer.start = 2
  trans.id = test.transactionGuid
  trans.webSegment = {
    getDurationInMillis: function () {
      return trans.timer.duration
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
    test.outboundRequests.forEach(function (req) {
      trans.pushPathHash(req.expectedOutboundPayload[3])
    })
  }

  return trans
}

describe('when CAT is disabled', function () {
  var agent

  before(function() {
    agent = helper.loadMockedAgent({cat: false})
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  tests.forEach(function(test) {
    it(test.name + ' transaction event should only contain non-CAT intrinsic attributes', function() {
      var trans = mockTransaction(agent, test, 5000)

      var attrs = agent._addIntrinsicAttrsFromTransaction(trans)

      var expected = {
        duration: 5,
        name: test.transactionName,
        timestamp: 2,
        type: 'Transaction',
        webDuration: 5,
        error: false
      }

      assert.deepEqual(attrs, expected)
    })
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

describe('when CAT is enabled', function () {
  var agent

  before(function() {
    // App name from test data
    agent = helper.loadMockedAgent({cat: true})
    agent.config.applications = function newFake() {
      return ['testAppName']
    }
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  var durations = [100, 300, 1000]

  tests.forEach(function(test, index) {
    it(test.name + ' transaction event should contain all intrinsic attributes', function() {
      var idx = index % durations.length
      var duration = durations[idx]
      var trans = mockTransaction(agent, test, duration)

      var attrs = agent._addIntrinsicAttrsFromTransaction(trans)

      var expected = {
        duration: duration/1000,
        name: test.transactionName,
        timestamp: 2,
        type: 'Transaction',
        webDuration: duration/1000,
        error: false,
        'nr.guid': test.expectedIntrinsicFields['nr.guid'],
        'nr.pathHash': test.expectedIntrinsicFields['nr.pathHash'],
        'nr.referringPathHash': test.expectedIntrinsicFields['nr.referringPathHash'],
        'nr.tripId': test.expectedIntrinsicFields['nr.tripId'],
        'nr.referringTransactionGuid': test.expectedIntrinsicFields['nr.referringTransactionGuid'],
        'nr.alternatePathHashes': test.expectedIntrinsicFields['nr.alternatePathHashes'],
      }
      if (test.expectedIntrinsicFields['nr.pathHash']) {
        // nr.apdexPerfZone not specified in the test, this is used to exercise it.
        switch (idx) {
          case 0:
            expected['nr.apdexPerfZone'] = 'S'
            break
          case 1:
            expected['nr.apdexPerfZone'] = 'T'
            break
          case 2:
            expected['nr.apdexPerfZone'] = 'F'
            break
        }

      }
      for (var i = 0; i < test.nonExpectedIntrinsicFields.length; i++) {
        delete expected[test.nonExpectedIntrinsicFields[i]]
      }
      assert.deepEqual(attrs, expected)
    })
  })
})
