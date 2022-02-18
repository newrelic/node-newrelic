/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('tap').test
const nock = require('nock')
const proxyquire = require('proxyquire')
const fetchSystemInfo = require('../../../lib/system-info')

test('pricing system-info aws', function (t) {
  const awsHost = 'http://169.254.169.254'

  const awsResponses = {
    'dynamic/instance-identity/document': {
      instanceType: 'test.type',
      instanceId: 'test.id',
      availabilityZone: 'us-west-2b'
    }
  }

  const awsRedirect = nock(awsHost)
  awsRedirect.put('/latest/api/token').reply(200, 'awsToken')
  // eslint-disable-next-line guard-for-in
  for (const awsPath in awsResponses) {
    awsRedirect.get('/2016-09-02/' + awsPath).reply(200, awsResponses[awsPath])
  }

  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: true,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    }
  })
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    t.same(systemInfo.vendors.aws, {
      instanceType: 'test.type',
      instanceId: 'test.id',
      availabilityZone: 'us-west-2b'
    })

    // This will throw an error if the sys info isn't being cached properly
    t.ok(awsRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(agent, function checkCache(err, cachedInfo) {
      t.same(cachedInfo.vendors.aws, {
        instanceType: 'test.type',
        instanceId: 'test.id',
        availabilityZone: 'us-west-2b'
      })
      t.end()
    })
  })
})

test('pricing system-info azure', function (t) {
  const azureHost = 'http://169.254.169.254'
  const azureResponse = {
    location: 'test.location',
    name: 'test.name',
    vmId: 'test.vmId',
    vmSize: 'test.vmSize'
  }

  const azureRedirect = nock(azureHost)
  azureRedirect.get('/metadata/instance/compute?api-version=2017-03-01').reply(200, azureResponse)

  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: true,
      detect_gcp: false,
      detect_docker: false
    }
  })
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    t.same(systemInfo.vendors.azure, {
      location: 'test.location',
      name: 'test.name',
      vmId: 'test.vmId',
      vmSize: 'test.vmSize'
    })

    // This will throw an error if the sys info isn't being cached properly
    t.ok(azureRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(agent, function checkCache(err, cachedInfo) {
      t.same(cachedInfo.vendors.azure, {
        location: 'test.location',
        name: 'test.name',
        vmId: 'test.vmId',
        vmSize: 'test.vmSize'
      })
      t.end()
    })
  })
})

test('pricing system-info gcp', function (t) {
  nock.disableNetConnect()

  t.teardown(function () {
    nock.enableNetConnect()
  })

  const gcpRedirect = nock('http://metadata.google.internal', {
    reqheaders: { 'Metadata-Flavor': 'Google' }
  })
    .get('/computeMetadata/v1/instance/')
    .query({ recursive: true })
    .reply(200, {
      id: '3161347020215157000',
      machineType: 'projects/492690098729/machineTypes/custom-1-1024',
      name: 'aef-default-20170501t160547-7gh8',
      zone: 'projects/492690098729/zones/us-central1-c'
    })

  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: true,
      detect_docker: false
    }
  })
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    const expectedData = {
      id: '3161347020215157000',
      machineType: 'custom-1-1024',
      name: 'aef-default-20170501t160547-7gh8',
      zone: 'us-central1-c'
    }
    t.same(systemInfo.vendors.gcp, expectedData)

    // This will throw an error if the sys info isn't being cached properly
    t.ok(gcpRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(agent, function checkCache(err, cachedInfo) {
      t.same(cachedInfo.vendors.gcp, expectedData)
      t.end()
    })
  })
})

test('pricing system-info pcf', function (t) {
  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: false,
      detect_pcf: true,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    }
  })
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  process.env.CF_INSTANCE_GUID = 'b977d090-83db-4bdb-793a-bb77'
  process.env.CF_INSTANCE_IP = '10.10.147.130'
  process.env.MEMORY_LIMIT = '1024m'

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    const expectedData = {
      cf_instance_guid: 'b977d090-83db-4bdb-793a-bb77',
      cf_instance_ip: '10.10.147.130',
      memory_limit: '1024m'
    }
    t.same(systemInfo.vendors.pcf, expectedData)
    t.end()
  })
})

test('pricing system-info docker', function (t) {
  const mockUtilization = proxyquire('../../../lib/utilization', {
    './docker-info': {
      getVendorInfo: function (agent, callback) {
        const data = { id: '47cbd16b77c50cbf71401c069cd2189f0e659af17d5a2daca3bddf59d8a870b2' }
        setImmediate(callback, null, data)
      }
    }
  })
  const fetchSystemInfoProxy = proxyquire('../../../lib/system-info', {
    './utilization': mockUtilization
  })

  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: true
    }
  })
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  fetchSystemInfoProxy(agent, function fetchSystemInfoCb(err, systemInfo) {
    const expectedData = {
      id: '47cbd16b77c50cbf71401c069cd2189f0e659af17d5a2daca3bddf59d8a870b2'
    }
    t.same(systemInfo.vendors.docker, expectedData)
    t.end()
  })
})
