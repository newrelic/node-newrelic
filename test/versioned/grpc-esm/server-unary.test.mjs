/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'

import helper from '../../lib/agent_helper.js'

import assertions from '../../lib/custom-assertions/index.js'
const { notHas } = assertions

import constants from '../grpc/constants.cjs'
const { ERR_CODE, ERR_SERVER_MSG } = constants

import { DESTINATIONS } from '../../../lib/config/attribute-filter.js'
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT

import util from '../grpc/util.cjs'
const {
  assertDistributedTracing,
  assertError,
  assertServerMetrics,
  assertServerTransaction,
  makeUnaryRequest,
  createServer,
  getClient,
  getServerTransactionName
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
  agent.metrics.clear()
})

test.after(() => {
  helper.unloadAgent(agent)
  server.forceShutdown()
  client.close()
})

test('should track unary server requests', async (t) => {
  let transaction
  function transactionFinished(tx) {
    transaction = tx
  }
  agent.on('transactionFinished', transactionFinished)
  t.after(() => {
    agent.removeListener('transactionFinished', transactionFinished)
  })

  const response = await makeUnaryRequest({
    client,
    fnName: 'sayHello',
    payload: { name: 'New Relic' }
  })
  assert.ok(response, 'response exists')
  assert.equal(response.message, 'Hello New Relic', 'response message is correct')
  assert.ok(transaction, 'transaction exists')
  assertServerTransaction({ transaction, fnName: 'SayHello' })
  assertServerMetrics({ agentMetrics: agent.metrics._metrics, fnName: 'SayHello' })
})

test('should add DT headers when `distributed_tracing` is enabled', async (t) => {
  let serverTransaction
  let clientTransaction
  function transactionFinished(tx) {
    if (tx.name === getServerTransactionName('SayHello')) {
      serverTransaction = tx
    }
  }
  agent.on('transactionFinished', transactionFinished)
  t.after(() => {
    agent.removeListener('transactionFinished', transactionFinished)
  })

  await helper.runInTransaction(agent, 'web', async (tx) => {
    clientTransaction = tx
    clientTransaction.name = 'clientTransaction'
    const response = await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'New Relic' }
    })
    assert.ok(response, 'response exists')
    tx.end()
  })

  assertDistributedTracing({ clientTransaction, serverTransaction })
})

test('should not include distributed trace headers when there is no client transaction', async (t) => {
  let serverTransaction
  function transactionFinished(tx) {
    serverTransaction = tx
  }
  agent.on('transactionFinished', transactionFinished)
  t.after(() => {
    agent.removeListener('transactionFinished', transactionFinished)
  })
  const payload = { name: 'dt not in transaction' }
  const response = await makeUnaryRequest({ client, fnName: 'sayHello', payload })
  assert.ok(response, 'response exists')
  const attributes = serverTransaction.trace.attributes.get(DESTINATION)
  notHas({
    found: attributes,
    doNotWant: 'request.header.newrelic',
    msg: 'should not have newrelic in headers'
  })
  notHas({
    found: attributes,
    doNotWant: 'request.header.traceparent',
    msg: 'should not have traceparent in headers'
  })
})

test('should not add DT headers when `distributed_tracing` is disabled', async (t) => {
  let serverTransaction
  let clientTransaction

  agent.on('transactionFinished', function transactionFinished(tx) {
    if (tx.name === getServerTransactionName('SayHello')) {
      serverTransaction = tx
    }
  })
  t.after(() => {
    agent.removeListener('transactionFinished', function transactionFinished(tx) {
      if (tx.name === getServerTransactionName('SayHello')) {
        serverTransaction = tx
      }
    })
  })

  agent.config.distributed_tracing.enabled = false
  await helper.runInTransaction(agent, 'web', async (tx) => {
    clientTransaction = tx
    clientTransaction.name = 'clientTransaction'
    const response = await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'New Relic' }
    })
    assert.ok(response, 'response exists')
    tx.end()
  })

  const attributes = serverTransaction.trace.attributes.get(DESTINATION)
  notHas({
    found: attributes,
    doNotWant: 'request.header.newrelic',
    msg: 'should not have newrelic in headers'
  })
  notHas({
    found: attributes,
    doNotWant: 'request.header.traceparent',
    msg: 'should not have traceparent in headers'
  })
})

const grpcConfigs = [
  { record_errors: true, ignore_status_codes: [], should: true },
  { record_errors: false, ignore_status_codes: [], should: false },
  { record_errors: true, ignore_status_codes: [9], should: false }
]
for (const config of grpcConfigs) {
  const should = config.should ? 'should' : 'should not'
  const testName = `${should} record errors in a transaction when ignoring ${config.ignore_status_codes}`

  test(testName, async (t) => {
    agent.config.grpc.record_errors = config.should
    const expectedStatusCode = ERR_CODE
    const expectedStatusText = ERR_SERVER_MSG
    let transaction
    function transactionFinished(tx) {
      if (tx.name === getServerTransactionName('SayError')) {
        transaction = tx
      }
    }
    agent.on('transactionFinished', transactionFinished)
    t.after(() => {
      agent.removeListener('transactionFinished', transactionFinished)
    })

    try {
      await makeUnaryRequest({
        client,
        fnName: 'sayError',
        payload: { oh: 'noes' }
      })
    } catch (err) {
      // err tested in client tests
    }

    assertError({
      transaction,
      errors: agent.errors,
      agentMetrics: agent.metrics._metrics,
      expectErrors: config.should,
      expectedStatusCode,
      expectedStatusText,
      fnName: 'SayError'
    })
  })
}
