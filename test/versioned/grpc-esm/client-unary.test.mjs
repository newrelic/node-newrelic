/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'

import helper from '../../lib/agent_helper.js'

import assertions from '../../lib/custom-assertions/index.js'
const { match } = assertions

import constants from '../grpc/constants.cjs'
const { ERR_CODE, ERR_MSG } = constants

import util from '../grpc/util.cjs'
const {
  assertError,
  assertExternalSegment,
  assertMetricsNotExisting,
  makeUnaryRequest,
  createServer,
  getClient
} = util

// This suite has to juggle the side effect-y nature of this setup because
// we don't have any way of re-importing `@grpc/grpc-js` while bypassing the
// module cache. If we tried to set up this suite properly, we'd instrument the
// library for the first subtest, and then the module would lose its
// instrumentation when the agent is recreated between tests, thus breaking
// the subsequent tests. So, be cautious adding any event handlers; they must
// be unregistered before a test ends, or they will interfere with other tests.
const agent = helper.instrumentMockedAgent()
const grpc = await import('@grpc/grpc-js')
const { port, proto, server } = await createServer(grpc)
const client = getClient(grpc, proto, port)

test.afterEach(() => {
  agent.errors.traceAggregator.clear()
  agent.transactionSampler._reset()
  agent.spanEventAggregator.clear()
  agent.metrics.clear()
})

test.after(() => {
  helper.unloadAgent(agent)
  server.forceShutdown()
  client.close()
})

test('should track unary client requests as an external when in a transaction', (t, end) => {
  function transactionFinished(transaction) {
    if (transaction.name === 'clientTransaction') {
      // Make sure we're in the client and not server transaction
      assertExternalSegment({ tx: transaction, fnName: 'SayHello', port })
      end()
    }
  }

  agent.on('transactionFinished', transactionFinished)
  t.after(() => {
    agent.removeListener('transactionFinished', transactionFinished)
  })

  helper.runInTransaction(agent, 'web', async (tx) => {
    tx.name = 'clientTransaction'

    const response = await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'New Relic' }
    })
    assert.ok(response, 'response exists')
    assert.equal(response.message, 'Hello New Relic', 'response message is correct')
    tx.end()
  })
})

test('should include distributed trace headers when enabled', (t, end) => {
  helper.runInTransaction(agent, 'dt-test', async (tx) => {
    const payload = { name: 'dt test' }
    await makeUnaryRequest({ client, fnName: 'sayHello', payload })
    const dtMeta = server.metadataMap.get(payload.name)
    match(
      dtMeta.get('traceparent')[0],
      /^[\w-]{55}$/,
      'should have traceparent in server metadata'
    )
    tx.end()
    end()
  })
})

test('should not include distributed trace headers when not in transaction', async () => {
  const payload = { name: 'dt not in transaction' }
  await makeUnaryRequest({ client, fnName: 'sayHello', payload })
  const dtMeta = server.metadataMap.get(payload.name)
  assert.equal(dtMeta.has('traceparent'), false, 'should not have traceparent in server metadata')
  assert.equal(dtMeta.has('newrelic'), false, 'should not have newrelic in server metadata')
})

test('should not include distributed trace headers when distributed_tracing.enabled is set to false', (t, end) => {
  agent.config.distributed_tracing.enabled = false
  t.after(() => {
    agent.config.distributed_tracing.enabled = true
  })
  helper.runInTransaction(agent, 'dt-test', async (tx) => {
    const payload = { name: 'dt disabled' }
    await makeUnaryRequest({ client, payload, fnName: 'sayHello' })
    const dtMeta = server.metadataMap.get(payload.name)
    assert.equal(dtMeta.has('traceparent'), false, 'should not have traceparent in server metadata')
    assert.equal(dtMeta.has('newrelic'), false, 'should not have newrelic in server metadata')
    tx.end()
    end()
  })
})

test('should not track external unary client requests outside of a transaction', async () => {
  const payload = { name: 'New Relic' }
  const response = await makeUnaryRequest({ client, fnName: 'sayHello', payload })
  assert.ok(response, 'response exists')
  assert.equal(response.message, 'Hello New Relic', 'response message is correct')
  assertMetricsNotExisting({ agent, port })
})

const grpcConfigs = [
  { record_errors: true, ignore_status_codes: [], should: true },
  { record_errors: false, ignore_status_codes: [], should: false },
  { record_errors: true, ignore_status_codes: [9], should: false }
]
for (const config of grpcConfigs) {
  const should = config.should ? 'should' : 'should not'
  const testName = `${should} record errors in a transaction when ignoring ${config.ignore_status_codes}`

  test(testName, (t, end) => {
    const expectedStatusText = ERR_MSG
    const expectedStatusCode = ERR_CODE
    agent.config.grpc.record_errors = config.record_errors
    agent.config.grpc.ignore_status_codes = config.ignore_status_codes

    function transactionFinished(transaction) {
      if (transaction.name === 'clientTransaction') {
        assertError({
          port,
          transaction,
          errors: agent.errors,
          expectErrors: config.should,
          expectedStatusCode,
          expectedStatusText,
          fnName: 'SayError',
          clientError: true
        })
        end()
      }
    }

    agent.on('transactionFinished', transactionFinished)
    t.after(() => {
      agent.removeListener('transactionFinished', transactionFinished)
    })

    helper.runInTransaction(agent, 'web', async (tx) => {
      tx.name = 'clientTransaction'

      try {
        const payload = { oh: 'noes' }
        await makeUnaryRequest({ client, fnName: 'sayError', payload })
      } catch (err) {
        assert.ok(err, 'should get an error')
        assert.equal(err.code, expectedStatusCode, 'should get the right status code')
        assert.equal(err.details, expectedStatusText, 'should get the correct error message')
        tx.end()
      }
    })
  })
}

test('should bind callback to the proper transaction context', (t, end) => {
  helper.runInTransaction(agent, 'web', async (tx) => {
    client.sayHello({ name: 'Callback' }, (err, response) => {
      assert.ifError(err)
      assert.ok(response)
      assert.equal(response.message, 'Hello Callback')
      assert.ok(agent.getTransaction(), 'callback should have transaction context')
      assert.equal(agent.getTransaction(), tx, 'transaction should be the one we started with')
      end()
    })
  })
})
