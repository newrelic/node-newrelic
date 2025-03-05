/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

const { routesToTest, makeRequest } = require('./common')
const { assertSegments, assertSpanKind } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')

module.exports = async function runTests(t, getExpectedSegments) {
  // Since we have spawned these sub-tests from another sub-test we must
  // clear out the agent before they are evaluated.
  helper.unloadAgent(t.nr.agent)

  for (const uri of routesToTest) {
    await t.test(`testing naming for ${uri} `, async (t) => {
      const { agent, fastify, calls } = t.nr

      agent.on('transactionFinished', (transaction) => {
        calls.test++
        assert.equal(
          `WebFrameworkUri/Fastify/GET/${uri}`,
          transaction.getName(),
          `transaction name matched for ${uri}`
        )

        let expectedSegments
        if (helper.isSecurityAgentEnabled(agent)) {
          // since k2 agent adds an onRequest hook
          // it sometimes has timers.setTimeout depending on route
          expectedSegments = [
            `WebTransaction/WebFrameworkUri/Fastify/GET/${uri}`,
            ['Nodejs/Middleware/Fastify/onRequest/<anonymous>', getExpectedSegments(uri)]
          ]
        } else {
          expectedSegments = [
            `WebTransaction/WebFrameworkUri/Fastify/GET/${uri}`,
            getExpectedSegments(uri)
          ]
        }

        assertSegments(transaction.trace, transaction.trace.root, expectedSegments)
        const [,...flattenedSegments] = expectedSegments.flat(3).map((name) => ({ name, kind: 'internal' }))
        assertSpanKind({
          agent,
          segments: [
            { name: expectedSegments[0], kind: 'server' },
            ...flattenedSegments
          ]
        })
      })

      await fastify.listen({ port: 0 })
      const address = fastify.server.address()
      const result = await makeRequest(address, uri)
      assert.equal(result.called, uri, `${uri} url did not error`)
      assert.ok(calls.test > 0)
      assert.equal(calls.test, calls.middleware, 'should be the same value')
    })
  }

  await t.test('should properly name transaction with parameterized routes', async (t) => {
    const { fastify, agent } = t.nr

    let txPassed = false
    agent.on('transactionFinished', (transaction) => {
      assert.equal(
        transaction.name,
        'WebTransaction/WebFrameworkUri/Fastify/GET//params/:id/:parent/edit'
      )
      assert.equal(transaction.url, '/params/id/parent/edit')

      txPassed = true
    })

    await fastify.listen()
    const address = fastify.server.address()
    const result = await makeRequest(address, '/params/id/parent/edit')
    assert.deepEqual(result, { id: 'id', parent: 'parent' })

    assert.equal(txPassed, true, 'transactionFinished assertions passed')
  })
}
