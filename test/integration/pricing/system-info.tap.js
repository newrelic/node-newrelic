'use strict'

var test = require('tap').test
var nock = require('nock')
var fetchSystemInfo = require('../../../lib/system-info')
var EventEmitter = require('events').EventEmitter


// XXX Remove this when deprecating Node v0.8.
if (!global.setImmediate) {
  global.setImmediate = function(fn) {
    global.setTimeout(fn, 0)
  }
}

test('pricing system-info', function(t) {
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


  var fakeAgent = new EventEmitter()
  fakeAgent.config = {
    utilization: {
      detect_aws: true,
      detect_docker: false
    }
  }

  fetchSystemInfo(fakeAgent, function cb_fetchSystemInfo(systemInfo) {
    t.same(systemInfo.aws, {
      type: 'test.type',
      id: 'test.id',
      zone: 'us-west-2b'
    })
    // This will throw an error if the sys info isn't being cached
    // properly
    t.ok(awsRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(fakeAgent, function checkCache(cachedInfo) {
      t.same(cachedInfo.aws, {
        type: 'test.type',
        id: 'test.id',
        zone: 'us-west-2b'
      })
      t.end()
    })
  })
})
