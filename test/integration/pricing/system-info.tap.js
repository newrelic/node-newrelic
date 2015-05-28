'use strict'

var nock = require('nock')
var assert = require('chai').assert
var fetchSystemInfo = require('../../../lib/system-info')

var awsHost = "http://169.254.169.254"

var awsResponses = {
  "instance-type": "test.type",
  "instance-id": "test.id",
  "placement/availability-zone": "us-west-2b"
}

var awsRedirect = nock(awsHost)
for (var awsPath in awsResponses) {
  awsRedirect.get('/2008-02-01/meta-data/' + awsPath).reply(200, awsResponses[awsPath])
}

var fakeAgent = {
  config: {
    utilization: {
      detect_aws: true,
      detect_docker: false
    }
  }
}

fetchSystemInfo(fakeAgent, function cb_fetchSystemInfo(systemInfo) {
  assert.deepEqual(systemInfo.aws, {
    type: 'test.type',
    id: 'test.id',
    zone: 'us-west-2b'
  })
  // This will throw an error if the sys info isn't being cached
  // properly
  assert(awsRedirect.isDone(), 'Expect nock endpoints to be exhausted')
  fetchSystemInfo(fakeAgent, function checkCache(cachedInfo) {
    assert.deepEqual(cachedInfo.aws, {
      type: 'test.type',
      id: 'test.id',
      zone: 'us-west-2b'
    })
  })
})
