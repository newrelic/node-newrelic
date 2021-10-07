/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { routesToTest, makeRequest } = require('./common')
const metrics = require('../../lib/metrics_helper')

module.exports = function createTests(t, getExpectedSegments) {
  routesToTest.forEach((uri) => {
    t.test(`testing naming for ${uri} `, async (t) => {
      const { agent, fastify, calls } = t.context

      agent.on('transactionFinished', (transaction) => {
        calls.test++
        t.equal(
          `WebFrameworkUri/Fastify/GET/${uri}`,
          transaction.getName(),
          `transaction name matched for ${uri}`
        )

        metrics.assertSegments(transaction.trace.root, [
          `WebTransaction/WebFrameworkUri/Fastify/GET/${uri}`,
          getExpectedSegments(uri)
        ])
      })

      await fastify.listen(0)
      const { port } = fastify.server.address()
      const url = `http://127.0.0.1:${port}${uri}`
      const result = await makeRequest(url)
      t.equal(result.called, uri, `${uri} url did not error`)
      t.ok(calls.test > 0)
      t.equal(calls.test, calls.middleware, 'should be the same value')
      t.end()
    })
  })

  t.test('should properly name transaction with parameterized routes', async (t) => {
    const { fastify, agent } = t.context

    agent.on('transactionFinished', (transaction) => {
      t.equal(
        transaction.name,
        'WebTransaction/WebFrameworkUri/Fastify/GET//params/:id/:parent/edit'
      )
      t.equal(transaction.url, '/params/id/parent/edit')
    })
    await fastify.listen()
    const { port } = fastify.server.address()
    const url = `http://127.0.0.1:${port}/params/id/parent/edit`
    const result = await makeRequest(url)
    t.same(result, { id: 'id', parent: 'parent' })
    t.end()
  })
}
