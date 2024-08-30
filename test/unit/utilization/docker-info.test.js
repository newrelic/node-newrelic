/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const helper = require('../../lib/agent_helper')
const standardResponse = require('./aws-ecs-api-response.json')
const { getBootId } = require('../../../lib/utilization/docker-info')

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

test('all tests', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.orig = {
      fs_access: fs.access,
      os_platform: os.platform
    }
    fs.access = (file, mode, cb) => {
      cb(Error('no proc file'))
    }
    os.platform = () => 'linux'

    ctx.nr.agent = helper.loadMockedAgent()
    ctx.nr.agent.config.utilization = {
      detect_aws: true,
      detect_azure: true,
      detect_gcp: true,
      detect_docker: true,
      detect_kubernetes: true,
      detect_pcf: true
    }

    ctx.nr.logs = []
    ctx.nr.logger = {
      debug(msg) {
        ctx.nr.logs.push(msg)
      }
    }

    ctx.nr.server = await getServer()
  })

  t.afterEach((ctx) => {
    fs.access = ctx.nr.orig.fs_access
    os.platform = ctx.nr.orig.os_platform

    ctx.nr.server.close()

    helper.unloadAgent(ctx.nr.agent)

    delete process.env.ECS_CONTAINER_METADATA_URI
    delete process.env.ECS_CONTAINER_METADATA_URI_V4
  })

  await t.test('skips if not in ecs container', (ctx, end) => {
    const { agent, logs, logger } = ctx.nr

    function callback(err, data) {
      assert.ifError(err)
      assert.deepEqual(logs, [
        'Container boot id is not available in cgroups info',
        'Container is not in a recognized ECS container, omitting boot info'
      ])
      assert.equal(data, null)
      assert.equal(
        agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
        1
      )
      end()
    }

    getBootId(agent, callback, logger)
  })

  await t.test('records request error', (ctx, end) => {
    const { agent, logs, logger, server } = ctx.nr
    const info = server.address()
    process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:0`

    function callback(err, data) {
      assert.ifError(err)
      assert.deepEqual(logs, [
        'Container boot id is not available in cgroups info',
        `Failed to query ECS endpoint, omitting boot info`
      ])
      assert.equal(data, null)
      assert.equal(
        agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
        1
      )
      end()
    }

    getBootId(agent, callback, logger)
  })

  await t.test('records json parsing error', (ctx, end) => {
    const { agent, logs, logger, server } = ctx.nr
    const info = server.address()
    process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:${info.port}/json-error`

    function callback(err, data) {
      assert.ifError(err)
      assert.deepEqual(logs[0], 'Container boot id is not available in cgroups info')
      assert.equal(data, null)
      assert.equal(
        agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
        1
      )
      end()
    }

    getBootId(agent, callback, logger)
  })

  await t.test('records error for no id in response', (ctx, end) => {
    const { agent, logs, logger, server } = ctx.nr
    const info = server.address()
    process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:${info.port}/no-id`

    function callback(err, data) {
      assert.ifError(err)
      assert.deepEqual(logs, [
        'Container boot id is not available in cgroups info',
        'Failed to find DockerId in response, omitting boot info'
      ])
      assert.equal(data, null)
      assert.equal(
        agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount,
        1
      )
      end()
    }

    getBootId(agent, callback, logger)
  })

  await t.test('records found id', (ctx, end) => {
    const { agent, logs, logger, server } = ctx.nr
    const info = server.address()
    // Cover the non-V4 case:
    process.env.ECS_CONTAINER_METADATA_URI = `http://${info.address}:${info.port}/success`

    function callback(err, data) {
      assert.ifError(err)
      assert.deepEqual(logs, ['Container boot id is not available in cgroups info'])
      assert.equal(data, '1e1698469422439ea356071e581e8545-2769485393')
      assert.ok(
        !agent.metrics._metrics.unscoped['Supportability/utilization/boot_id/error']?.callCount
      )
      end()
    }

    getBootId(agent, callback, logger)
  })
})
