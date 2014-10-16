'use strict'
/*jshint expr:true*/

var helper = require('../../lib/agent_helper.js')
  , chai = require('chai')
  , assert = chai.assert
  , Transaction = require('../../../lib/transaction')
  , tests = require('../../lib/cross_agent_tests/cat_map.json')
  , _isValidReferringHash = require('../../../lib/instrumentation/core/http.js')._isValidReferringHash


function mockTransaction(agent, test, duration) {
  var trans = new Transaction(agent)

  // non-CAT data
  trans.name = test.transactionName
  trans.timer.duration = duration
  trans.timer.start = 2
  trans.id = test.transactionGuid
  trans.webSegment = {getDurationInMillis: function () {return trans.timer.duration}}

  // CAT data

  if (test.inboundPayload) {
    trans.tripId = test.inboundPayload[2]
    trans.referringTransactionGuid = test.inboundPayload[0]

    if (_isValidReferringHash(test.inboundPayload[3])) {
      trans.referringPathHash = test.inboundPayload[3]
    }
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
    agent = helper.loadMockedAgent({cat: false});
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
      }

      assert.deepEqual(attrs, expected)
    })
  })
})

describe('when CAT is enabled', function () {
  var agent

  before(function() {
    // App name from test data
    // encoding_key from ben in agent dev
    agent = helper.loadMockedAgent({cat: true})
    agent.config.applications = function newFake() {return ['testAppName'];}
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
