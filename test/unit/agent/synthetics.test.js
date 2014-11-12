var helper = require('../../lib/agent_helper')
var expect = require('chai').expect

describe('synthetics transaction traces', function () {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent({
      synthetics: true
    }, {
      trusted_account_ids: [357]
    })
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('should include synthetic intrinsics if header is set', function (done) {
    helper.runInTransaction(agent, function (txn) {
      txn.syntheticsData = {
        version: 1,
        accountId: 357,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      txn.end(function () {
        var trace = txn.trace
        expect(trace.intrinsics['synthetics_resource_id']).equal('resId')
        expect(trace.intrinsics['synthetics_job_id']).equal('jobId')
        expect(trace.intrinsics['synthetics_monitor_id']).equal('monId')
        done()
      })

    })
  })

  it('should not include synthetic intrinsics if feature flag is off', function (done) {
    agent.config.feature_flag.synthetics = false
    helper.runInTransaction(agent, function (txn) {
      txn.syntheticsData = {
        version: 1,
        accountId: 357,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      txn.end(function () {
        var trace = txn.trace
        expect(trace.intrinsics['synthetics_resource_id']).not.exist()
        expect(trace.intrinsics['synthetics_job_id']).not.exist()
        expect(trace.intrinsics['synthetics_monitor_id']).not.exist()
        done()
      })

    })
  })
})
