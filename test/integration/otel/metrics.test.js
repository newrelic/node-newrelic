/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const https = require('node:https')
const { once } = require('node:events')

const fakeCert = require('#testlib/fake-cert.js')
const promiseResolvers = require('#testlib/promise-resolvers.js')
const helper = require('#testlib/agent_helper.js')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    }
  })
  ctx.nr.agent.config.entity_guid = 'guid-123456'
  ctx.nr.agent.config.license_key = 'license-123456'

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const cert = fakeCert()
  const serverOpts = {
    key: cert.privateKeyBuffer,
    cert: cert.certificateBuffer
  }

  ctx.nr.requestResolvers = promiseResolvers()
  ctx.nr.data = {}
  const server = https.createServer(serverOpts, (req, res) => {
    ctx.nr.data.path = req.url
    ctx.nr.data.headers = structuredClone(req.headers)

    let payload = ''
    req.on('data', d => {
      payload += d
    })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')

      ctx.nr.data.payload = payload
      ctx.nr.requestResolvers.resolve()
    })
  })

  ctx.nr.server = server
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', error => {
      if (error) return reject(error)
      ctx.nr.agent.config.host = server.address().address
      ctx.nr.agent.config.port = server.address().port
      resolve()
    })
  })
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.close()
})

test('sends metrics', { timeout: 5_000 }, async (t) => {
  const { agent, requestResolvers: { promise: request } } = t.nr

  process.nextTick(() => agent.emit('started'))
  await once(agent, 'started')

  const { metrics } = require('@opentelemetry/api')
  const counter = metrics.getMeter('test-meter').createCounter('test-counter')
  counter.add(1, { foo: 'bar' })

  await request
  assert.equal(t.nr.data.path, '/v1/metrics')
  assert.equal(t.nr.data.headers['api-key'], agent.config.license_key)
  assert.match(t.nr.data.payload, /guid-123456/)
  assert.match(t.nr.data.payload, /test-meter/)
  assert.match(t.nr.data.payload, /test-counter/)
  assert.match(t.nr.data.payload, /foo/)
  assert.match(t.nr.data.payload, /bar/)
})
