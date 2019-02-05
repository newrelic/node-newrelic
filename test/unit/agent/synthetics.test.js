'use strict'

var helper = require('../../lib/agent_helper')
var expect = require('chai').expect

describe('synthetics transaction traces', function() {
  var agent

  beforeEach(function() {
    agent = helper.loadMockedAgent({
      trusted_account_ids: [357]
    })
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  it('should include synthetic intrinsics if header is set', function(done) {
    helper.runInTransaction(agent, function(txn) {
      txn.syntheticsData = {
        version: 1,
        accountId: 357,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      txn.end()
      var trace = txn.trace
      expect(trace.intrinsics).to.have.property('synthetics_resource_id', 'resId')
      expect(trace.intrinsics).to.have.property('synthetics_job_id', 'jobId')
      expect(trace.intrinsics).to.have.property('synthetics_monitor_id', 'monId')
      done()
    })
  })
})
