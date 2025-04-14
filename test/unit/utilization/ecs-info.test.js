/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')

const helper = require('../../lib/agent_helper')
const standardResponse = require('./aws-ecs-api-response.json')
const fetchEcsInfo = require('../../../lib/utilization/ecs-info')

async function getServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })

    switch (req.url) {
      case '/json-error': {
        res.end('{"invalid":"json"')
        break
      }

      case '/no-id': {
        res.end('{}')
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

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: true
    }
  })

  ctx.nr.logs = []
  ctx.nr.logger = {
    debug(...args) {
      ctx.nr.logs.push(args)
    }
  }

  ctx.nr.server = await getServer()
})

test.afterEach((ctx) => {
  ctx.nr.server.close()
  helper.unloadAgent(ctx.nr.agent)

  delete process.env.ECS_CONTAINER_METADATA_URI
  delete process.env.ECS_CONTAINER_METADATA_URI_V4
})

test('returns null if utilization is disabled', (t, end) => {
  const agent = {
    config: {
      utilization: false
    }
  }
  fetchEcsInfo(agent, (error, data) => {
    assert.equal(error, null)
    assert.equal(data, null)
    end()
  })
})

test('returns null if error encountered', (t, end) => {
  const { agent } = t.nr

  fetchEcsInfo(
    agent,
    (error, data) => {
      assert.equal(error.message, 'boom')
      assert.equal(data, null)
      end()
    },
    {
      getEcsContainerId,
      hasAwsContainerApi() {
        return true
      }
    }
  )

  function getEcsContainerId({ callback }) {
    callback(Error('boom'))
  }
})

test('skips if not in ecs container', (ctx, end) => {
  const { agent, logs, logger } = ctx.nr

  function callback(err, data) {
    assert.ifError(err)
    assert.deepEqual(logs, [[{ utilization: 'ecs' }, 'ECS API not available, omitting ECS container id info']])
    assert.equal(data, null)
    assert.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/ecs/container_id/error']
        ?.callCount,
      1
    )
    end()
  }

  fetchEcsInfo(agent, callback, { logger })
})

test('records request error', (ctx, end) => {
  const { agent, logs, logger, server } = ctx.nr
  const info = server.address()
  process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:0`

  function callback(err, data) {
    assert.ifError(err)
    assert.deepEqual(logs, [[{ utilization: 'ecs' }, 'Failed to query ECS endpoint, omitting boot info']])
    assert.equal(data, null)
    assert.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/ecs/container_id/error']
        ?.callCount,
      1
    )
    end()
  }

  fetchEcsInfo(agent, callback, { logger })
})

test('records json parsing error', (ctx, end) => {
  const { agent, logs, logger, server } = ctx.nr
  const info = server.address()
  process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:${info.port}/json-error`

  function callback(err, data) {
    assert.ifError(err)
    assert.equal(logs.length, 1)
    assert.equal(
      logs[0][1].startsWith('Failed to process ECS API response, omitting boot info:'),
      true
    )
    assert.equal(data, null)
    assert.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/ecs/container_id/error']
        ?.callCount,
      1
    )
    end()
  }

  fetchEcsInfo(agent, callback, { logger })
})

test('records error for no id in response', (ctx, end) => {
  const { agent, logs, logger, server } = ctx.nr
  const info = server.address()
  process.env.ECS_CONTAINER_METADATA_URI_V4 = `http://${info.address}:${info.port}/no-id`

  function callback(err, data) {
    assert.ifError(err)
    assert.deepEqual(logs, [[{ utilization: 'ecs' }, 'Failed to find DockerId in response, omitting boot info']])
    assert.equal(data, null)
    assert.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/ecs/container_id/error']
        ?.callCount,
      1
    )
    end()
  }

  fetchEcsInfo(agent, callback, { logger })
})

test('records found id', (ctx, end) => {
  const { agent, logs, logger, server } = ctx.nr
  const info = server.address()
  // Cover the non-V4 case:
  process.env.ECS_CONTAINER_METADATA_URI = `http://${info.address}:${info.port}/success`

  function callback(err, data) {
    assert.ifError(err)
    assert.deepEqual(logs, [])
    assert.deepStrictEqual(data, { ecsDockerId: '1e1698469422439ea356071e581e8545-2769485393' })
    assert.equal(
      agent.metrics._metrics.unscoped['Supportability/utilization/ecs/container_id/error']
        ?.callCount,
      undefined
    )
    end()
  }

  fetchEcsInfo(agent, callback, { logger })
})
