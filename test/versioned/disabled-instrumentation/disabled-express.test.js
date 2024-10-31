/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const http = require('http')
const params = require('../../lib/params')
const { assertSegments } = require('../../lib/custom-assertions')

test('should still record child segments if express instrumentation is disabled', async (t) => {
  const agent = helper.instrumentMockedAgent({
    instrumentation: {
      express: {
        enabled: false
      }
    }
  })
  const express = require('express')
  const app = express()
  const Redis = require('ioredis')
  const client = new Redis(params.redis_port, params.redis_host)

  app.get('/test-me', (_req, res) => {
    client.get('foo', (err) => {
      assert.equal(err, undefined)
      res.end()
    })
  })

  const promise = new Promise((resolve) => {
    agent.on('transactionFinished', (tx) => {
      assert.equal(tx.name, 'WebTransaction/NormalizedUri/*', 'should not name transactions')
      const rootSegment = tx.trace.root
      const expectedSegments = ['WebTransaction/NormalizedUri/*', ['Datastore/operation/Redis/get']]
      assertSegments(tx.trace, rootSegment, expectedSegments)
      resolve()
    })
  })

  const server = app.listen(() => {
    const { port } = server.address()
    http.request({ port, path: '/test-me' }).end()
  })

  t.after(() => {
    server.close()
    client.disconnect()
    helper.unloadAgent(agent)
  })

  await promise
})
