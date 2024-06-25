/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const helper = require('../../lib/agent_helper')
const standardResponse = require('./aws-ecs-api-response.json')
const { getBootId } = require('../../../lib/utilization/docker-info')

tap.beforeEach(async (t) => {
  t.context.orig = {
    fs_access: fs.access,
    os_platform: os.platform
  }
  fs.access = (file, mode, cb) => {
    cb(Error('no proc file'))
  }
  os.platform = () => 'linux'

  t.context.agent = helper.loadMockedAgent()
  t.context.agent.config.utilization = {
    detect_aws: true,
    detect_azure: true,
    detect_gcp: true,
    detect_docker: true,
    detect_kubernetes: true,
    detect_pcf: true
  }

  t.context.logs = []
  t.context.logger = {
    debug(msg) {
      t.context.logs.push(msg)
    }
  }

  t.context.server = await getServer()
})

tap.afterEach((t) => {
  fs.access = t.context.orig.fs_access
  os.platform = t.context.orig.os_platform

  t.context.server.close()

  helper.unloadAgent(t.context.agent)

  delete process.env.ECS_CONTAINER_METADATA_URI
  delete process.env.ECS_CONTAINER_METADATA_URI_V4
})

async function getServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })

    switch (req.url) {
      case '/json-error': {
        res.end(`{"invalid":"json"`)
        break
      }

      case '/no-id': {
        res.end(`{}`)
        break
      }

      default: {
        res.end(JSON.stringify(standardResponse))
      }
    }
  })

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve()
    })
  })

  return server
}

tap.test('skips if not in ecs container', (t) => {
  const { agent, logs, logger } = t.context

  function callback(err, data) {
    t.error(err)
    t.strictSame(logs, [
      'Container boot id is not available in cgroups info',
      'Container is not in a recognized ECS container, omitting boot info'
    ])
    t.equal(data, null)
    t.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
      1
    )
    t.end()
  }

  getBootId(agent, callback, logger)
})

tap.test('records request error', (t) => {
  const { agent, logs, logger, server } = t.context
  const info = server.address()
  process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:0`

  function callback(err, data) {
    t.error(err)
    t.strictSame(logs, [
      'Container boot id is not available in cgroups info',
      `Failed to query ECS endpoint, omitting boot info`
    ])
    t.equal(data, null)
    t.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
      1
    )
    t.end()
  }

  getBootId(agent, callback, logger)
})

tap.test('records json parsing error', (t) => {
  const { agent, logs, logger, server } = t.context
  const info = server.address()
  process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:${info.port}/json-error`

  function callback(err, data) {
    t.error(err)
    t.match(logs, [
      'Container boot id is not available in cgroups info',
      // Node 16 has a different format for JSON parsing errors:
      /Failed to process ECS API response, omitting boot info: (Expected|Unexpected)/
    ])
    t.equal(data, null)
    t.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
      1
    )
    t.end()
  }

  getBootId(agent, callback, logger)
})

tap.test('records error for no id in response', (t) => {
  const { agent, logs, logger, server } = t.context
  const info = server.address()
  process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:${info.port}/no-id`

  function callback(err, data) {
    t.error(err)
    t.strictSame(logs, [
      'Container boot id is not available in cgroups info',
      'Failed to find DockerId in response, omitting boot info'
    ])
    t.equal(data, null)
    t.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
      1
    )
    t.end()
  }

  getBootId(agent, callback, logger)
})

tap.test('records found id', (t) => {
  const { agent, logs, logger, server } = t.context
  const info = server.address()
  // Cover the non-V4 case:
  process.env.ECS_CONTAINER_METADATA_URI = `http://${info.address}:${info.port}/success`

  function callback(err, data) {
    t.error(err)
    t.strictSame(logs, ['Container boot id is not available in cgroups info'])
    t.equal(data, '1e1698469422439ea356071e581e8545-2769485393')
    t.notOk(agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount)
    t.end()
  }

  getBootId(agent, callback, logger)
})
