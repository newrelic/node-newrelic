/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const fetchSystemInfo = require('../../../lib/system-info')
const common = require('../../../lib/utilization/common')
const { jsonReply } = require('../../lib/collector-reply-utils')
const LocalMetadataServer = require('../../lib/local-metadata-server')

test.beforeEach(async (ctx) => {
  const server = new LocalMetadataServer()
  await server.listen()
  ctx.nr = { server }
})

test.afterEach((ctx) => {
  ctx.nr.server.close()
})

/**
 * Builds a `fetchSystemInfo` that resolves the given vendor's metadata
 * requests against `server` instead of the real metadata endpoint, by
 * `proxyquire`-ing `resolveMetadataHost` rather than defining environment
 * variables.
 *
 * @param {string} vendorFile e.g. `'aws-info'`.
 * @param {object} server mock http server
 * @returns {Function} A `fetchSystemInfo(agent, callback)` function.
 */
function fetchSystemInfoWithMockedHost(vendorFile, server) {
  const mockVendorInfo = proxyquire(`../../../lib/utilization/${vendorFile}`, {
    './common': {
      ...common,
      resolveMetadataHost: () => { return { host: server.host, port: server.port } }
    }
  })
  const mockUtilization = proxyquire('../../../lib/utilization', {
    [`./${vendorFile}`]: mockVendorInfo
  })
  return proxyquire('../../../lib/system-info', {
    './utilization': mockUtilization
  })
}

test('pricing system-info aws', function (t, end) {
  const { server } = t.nr
  process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${server.hostPort}/docker`

  const awsResponses = {
    'dynamic/instance-identity/document': {
      instanceType: 'test.type',
      instanceId: 'test.id',
      availabilityZone: 'us-west-2b'
    }
  }

  const ecsRoute = server.addRoute('GET', '/docker', (req, res) => {
    const [body, headers] = jsonReply({ DockerId: 'ecs-container-1' })
    res.writeHead(200, headers)
    res.end(body)
  })
  const tokenRoute = server.addRoute('PUT', '/latest/api/token', (req, res) => {
    res.writeHead(200)
    res.end('awsToken')
  })
  const metadataRoutes = Object.keys(awsResponses).map((awsPath) => server.addRoute('GET', `/latest/${awsPath}`, (req, res) => {
    const [body, headers] = jsonReply(awsResponses[awsPath])
    res.writeHead(200, headers)
    res.end(body)
  }))

  const fetchSystemInfoProxy = fetchSystemInfoWithMockedHost('aws-info', server)
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

  fetchSystemInfoProxy(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    assert.deepEqual(systemInfo.vendors.aws, {
      instanceType: 'test.type',
      instanceId: 'test.id',
      availabilityZone: 'us-west-2b'
    })
    assert.deepEqual(systemInfo.vendors.ecs, { ecsDockerId: 'ecs-container-1' })

    // This will throw an error if the sys info isn't being cached properly
    assert.ok(tokenRoute.isDone(), 'should exhaust aws endpoints')
    assert.ok(metadataRoutes.every((route) => route.isDone()), 'should exhaust aws endpoints')
    assert.ok(ecsRoute.isDone())
    fetchSystemInfoProxy(agent, function checkCache(err, cachedInfo) {
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
  const { server } = t.nr
  const azureResponse = {
    location: 'test.location',
    name: 'test.name',
    vmId: 'test.vmId',
    vmSize: 'test.vmSize'
  }

  const azureRoute = server.addRoute('GET', '/metadata/instance/compute', (req, res) => {
    assert.equal(req.headers.metadata, 'true', 'should send the Metadata header')
    const [body, headers] = jsonReply(azureResponse)
    res.writeHead(200, headers)
    res.end(body)
  })

  const fetchSystemInfoProxy = fetchSystemInfoWithMockedHost('azure-info', server)
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

  fetchSystemInfoProxy(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    assert.deepEqual(systemInfo.vendors.azure, {
      location: 'test.location',
      name: 'test.name',
      vmId: 'test.vmId',
      vmSize: 'test.vmSize'
    })

    // This will throw an error if the sys info isn't being cached properly
    assert.ok(azureRoute.isDone(), 'should exhaust metadata endpoint')
    fetchSystemInfoProxy(agent, function checkCache(err, cachedInfo) {
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
  const { server } = t.nr
  const gcpRoute = server.addRoute('GET', '/computeMetadata/v1/instance/', (req, res) => {
    assert.equal(req.headers['metadata-flavor'], 'Google', 'should send the Metadata-Flavor header')
    const [body, headers] = jsonReply({
      id: '3161347020215157123',
      machineType: 'projects/492690098729/machineTypes/custom-1-1024',
      name: 'aef-default-20170501t160547-7gh8',
      zone: 'projects/492690098729/zones/us-central1-c'
    })
    res.writeHead(200, headers)
    res.end(body)
  })

  const fetchSystemInfoProxy = fetchSystemInfoWithMockedHost('gcp-info', server)
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

  fetchSystemInfoProxy(agent, function fetchSystemInfoCb(err, systemInfo) {
    assert.ifError(err)
    const expectedData = {
      id: '3161347020215157123',
      machineType: 'custom-1-1024',
      name: 'aef-default-20170501t160547-7gh8',
      zone: 'us-central1-c'
    }
    assert.deepEqual(systemInfo.vendors.gcp, expectedData)

    // This will throw an error if the sys info isn't being cached properly
    assert.ok(gcpRoute.isDone(), 'should exhaust metadata endpoint')
    fetchSystemInfoProxy(agent, function checkCache(err, cachedInfo) {
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
