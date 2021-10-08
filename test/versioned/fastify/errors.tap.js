/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const semver = require('semver')
const { makeRequest } = require('./common')

tap.test('Test Errors', async (test) => {
  const agent = helper.instrumentMockedAgent()
  const fastify = require('fastify')()
  const { version: pkgVersion } = require('fastify/package')

  test.teardown(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })

  if (semver.satisfies(pkgVersion, '>=3')) {
    await fastify.register(require('middie'))
  }

  fastify.use((req, res, next) => {
    const err = new Error('Not found')
    // eslint-disable-next-line new-cap
    err.status = 404
    next(err)
  })

  await fastify.listen(0)
  const url = `http://127.0.0.1:${fastify.server.address().port}/404-via-reply`
  const res = await makeRequest(url)
  test.equal(res.statusCode, 404)
  test.end()
})
