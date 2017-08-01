'use strict'

var test = require('tap').test
var nock = require('nock')
var fetchSystemInfo = require('../../../lib/system-info')
var EventEmitter = require('events').EventEmitter


test('pricing system-info aws', function(t) {
  var awsHost = "http://169.254.169.254"

  var awsResponses = {
    "dynamic/instance-identity/document": {
      "instanceType": "test.type",
      "instanceId": "test.id",
      "availabilityZone": "us-west-2b"
    }
  }

  var awsRedirect = nock(awsHost)
  for (var awsPath in awsResponses) { // eslint-disable-line guard-for-in
    awsRedirect.get('/2016-09-02/' + awsPath).reply(200, awsResponses[awsPath])
  }

  var fakeAgent = new EventEmitter()
  fakeAgent.config = {
    utilization: {
      detect_aws: true,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
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

test('pricing system-info gcp', function(t) {
  nock.disableNetConnect()

  t.tearDown(function() {
    nock.enableNetConnect()
  })

  var gcpRedirect = nock('http://metadata.google.internal', {
      reqheaders: {
        'Metadata-Flavor': 'Google'
      }
    })
    .get('/computeMetadata/v1/instance/')
    .query({recursive: true})
    .reply(200, {
      id: '3161347020215157000',
      machineType: 'projects/492690098729/machineTypes/custom-1-1024',
      name: 'aef-default-20170501t160547-7gh8',
      zone: 'projects/492690098729/zones/us-central1-c'
    })

  var fakeAgent = new EventEmitter()
  fakeAgent.config = {
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: true,
      detect_docker: false
    }
  }

  fetchSystemInfo(fakeAgent, function cb_fetchSystemInfo(systemInfo) {
    var expectedData = {
      id: '3161347020215157000',
      machineType: 'custom-1-1024',
      name: 'aef-default-20170501t160547-7gh8',
      zone: 'us-central1-c'
    }
    t.same(systemInfo.vendors.gcp, expectedData)
    // This will throw an error if the sys info isn't being cached
    // properly
    t.ok(gcpRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(fakeAgent, function checkCache(cachedInfo) {
      t.same(cachedInfo.vendors.gcp, expectedData)
      t.end()
    })
  })
})
