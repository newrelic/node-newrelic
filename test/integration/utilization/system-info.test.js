/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const assert = require('node:assert')
const nock = require('nock')
const proxyquire = require('proxyquire')
const fetchSystemInfo = require('../../../lib/system-info')

test.beforeEach(() => {
  nock.disableNetConnect()
})

test.afterEach(() => {
  nock.enableNetConnect()
})

test('pricing system-info aws', function (t, end) {
  const awsHost = 'http://169.254.169.254'
  process.env.ECS_CONTAINER_METADATA_URI_V4 = awsHost + '/docker'

  const awsResponses = {
    'dynamic/instance-identity/document': {
      instanceType: 'test.type',
      instanceId: 'test.id',
      availabilityZone: 'us-west-2b'
    }
  }

  const ecsScope = nock(awsHost).get('/docker').reply(200, { DockerId: 'ecs-container-1' })
  const awsRedirect = nock(awsHost)
  awsRedirect.put('/latest/api/token').reply(200, 'awsToken')

  for (const awsPath in awsResponses) {
    awsRedirect.get(`/latest/${awsPath}`).reply(200, awsResponses[awsPath])
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
  t.after(function () {
    helper.unloadAgent(agent)
    delete process.env.ECS_CONTAINER_METADATA_URI_V4
  })

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    assert.deepEqual(systemInfo.vendors.aws, {
      instanceType: 'test.type',
      instanceId: 'test.id',
      availabilityZone: 'us-west-2b'
    })
    assert.deepEqual(systemInfo.vendors.ecs, { ecsDockerId: 'ecs-container-1' })

    // This will throw an error if the sys info isn't being cached properly
    assert.ok(awsRedirect.isDone(), 'should exhaust nock endpoints')
    assert.ok(ecsScope.isDone())
    fetchSystemInfo(agent, function checkCache(err, cachedInfo) {
      assert.ifError(err)
      assert.deepEqual(cachedInfo.vendors.aws, {
        instanceType: 'test.type',
        instanceId: 'test.id',
        availabilityZone: 'us-west-2b'
      })
      end()
    })
  })
})

test('pricing system-info azure', function (t, end) {
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
  t.after(function () {
    helper.unloadAgent(agent)
  })

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    assert.deepEqual(systemInfo.vendors.azure, {
      location: 'test.location',
      name: 'test.name',
      vmId: 'test.vmId',
      vmSize: 'test.vmSize'
    })

    // This will throw an error if the sys info isn't being cached properly
    assert.ok(azureRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(agent, function checkCache(err, cachedInfo) {
      assert.ifError(err)
      assert.deepEqual(cachedInfo.vendors.azure, {
        location: 'test.location',
        name: 'test.name',
        vmId: 'test.vmId',
        vmSize: 'test.vmSize'
      })
      end()
    })
  })
})

test('pricing system-info gcp', function (t, end) {
  const gcpRedirect = nock('http://metadata.google.internal', {
    reqheaders: { 'Metadata-Flavor': 'Google' }
  })
    .get('/computeMetadata/v1/instance/')
    .query({ recursive: true })
    .reply(200, {
      id: '3161347020215157123',
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
  t.after(function () {
    helper.unloadAgent(agent)
  })

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    const expectedData = {
      id: '3161347020215157123',
      machineType: 'custom-1-1024',
      name: 'aef-default-20170501t160547-7gh8',
      zone: 'us-central1-c'
    }
    assert.deepEqual(systemInfo.vendors.gcp, expectedData)

    // This will throw an error if the sys info isn't being cached properly
    assert.ok(gcpRedirect.isDone(), 'should exhaust nock endpoints')
    fetchSystemInfo(agent, function checkCache(err, cachedInfo) {
      assert.ifError(err)
      assert.deepEqual(cachedInfo.vendors.gcp, expectedData)
      end()
    })
  })
})

test('pricing system-info pcf', function (t, end) {
  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: false,
      detect_pcf: true,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    }
  })
  t.after(function () {
    helper.unloadAgent(agent)
  })

  process.env.CF_INSTANCE_GUID = 'b977d090-83db-4bdb-793a-bb77'
  process.env.CF_INSTANCE_IP = '10.10.147.130'
  process.env.MEMORY_LIMIT = '1024m'

  fetchSystemInfo(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    const expectedData = {
      cf_instance_guid: 'b977d090-83db-4bdb-793a-bb77',
      cf_instance_ip: '10.10.147.130',
      memory_limit: '1024m'
    }
    assert.deepEqual(systemInfo.vendors.pcf, expectedData)
    end()
  })
})

test('pricing system-info docker', function (t, end) {
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
  t.after(function () {
    helper.unloadAgent(agent)
  })

  fetchSystemInfoProxy(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    const expectedData = {
      id: '47cbd16b77c50cbf71401c069cd2189f0e659af17d5a2daca3bddf59d8a870b2'
    }
    assert.deepEqual(systemInfo.vendors.docker, expectedData)
    end()
  })
})
