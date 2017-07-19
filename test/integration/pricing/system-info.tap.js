'use strict'

var test = require('tap').test
var nock = require('nock')
var fetchSystemInfo = require('../../../lib/system-info')
var EventEmitter = require('events').EventEmitter


test('pricing system-info', function(t) {
  var awsHost = "http://169.254.169.254"

  var awsResponses = {
    "dynamic/instance-identity/document": {
      "instanceType": "test.type",
      "instanceId": "test.id",
      "availabilityZone": "us-west-2b"
    }
  }

  var awsRedirect = nock(awsHost)
  for (var awsPath in awsResponses) {
    awsRedirect.get('/2016-09-02/' + awsPath).reply(200, awsResponses[awsPath])
  }


  var fakeAgent = new EventEmitter()
  fakeAgent.config = {
    utilization: {
      detect_aws: true,
      detect_docker: false
    }
  }

  fetchSystemInfo(fakeAgent, function cb_fetchSystemInfo(systemInfo) {
    t.same(systemInfo.vendors.aws, {
      instanceType: 'test.type',
      instanceId: 'test.id',
      availabilityZone: 'us-west-2b'
    })
    // This will throw an error if the sys info isn't being cached
    // properly
    t.ok(awsRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(fakeAgent, function checkCache(cachedInfo) {
      t.same(cachedInfo.vendors.aws, {
        instanceType: 'test.type',
        instanceId: 'test.id',
        availabilityZone: 'us-west-2b'
      })
      t.end()
    })
  })
})
