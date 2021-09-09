/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const request = require('request')
const helper = require('../../lib/agent_helper')
const httpErrors = require('http-errors')
const semver = require('semver')

const testErrorHandled = (agent, uri, port) => {
  return new Promise((resolve) => {
    request.get(`http://127.0.0.1:${port}${uri}`, function () {
      resolve()
    })
  })
}

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
    // eslint-disable-next-line new-cap
    next(httpErrors.NotFound())
  })

  return fastify.listen(0).then(() => {
    return testErrorHandled(agent, '/404-via-reply', fastify.server.address().port)
  })
})
