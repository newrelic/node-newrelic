/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const semver = require('semver')

const helper = require('../../lib/agent_helper')
const { makeRequest } = require('./common')

test('Test Errors', async (t) => {
  const agent = helper.instrumentMockedAgent()
  const fastify = require('fastify')()
  const { version: pkgVersion } = require('fastify/package')

  t.after(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })

  if (semver.major(pkgVersion) < 4) {
    await fastify.register(require('middie'))
  } else {
    await fastify.register(require('@fastify/middie'))
  }

  fastify.use((req, res, next) => {
    const err = new Error('Not found')

    err.status = 404
    next(err)
  })

  await fastify.listen({ port: 0 })
  const address = fastify.server.address()
  const res = await makeRequest(address, '/404-via-reply')
  assert.equal(res.statusCode, 404)
})
