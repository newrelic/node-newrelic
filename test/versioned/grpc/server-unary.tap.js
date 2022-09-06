/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT
const { ERR_CODE, ERR_SERVER_MSG } = require('./constants')

const {
  makeUnaryRequest,
  createServer,
  getClient,
  getServerTransactionName,
  assertError,
  assertServerTransaction,
  assertServerMetrics,
  assertDistributedTracing
} = require('./util')

tap.test('gRPC Server: Unary Requests', (t) => {
  t.autoend()

  let agent
  let client
  let server
  let proto
  let grpc

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = require('@grpc/grpc-js')
    const data = await createServer(grpc)
    proto = data.proto
    server = data.server
    client = getClient(grpc, proto)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    server.forceShutdown()
    client.close()
    grpc = null
    proto = null
  })

  t.test('should track unary server requests', async (t) => {
    let transaction
    agent.on('transactionFinished', (tx) => {
      transaction = tx
    })

    const response = await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'New Relic' }
    })
    t.ok(response, 'response exists')
    t.equal(response.message, 'Hello New Relic', 'response message is correct')
    t.ok(transaction, 'transaction exists')
    assertServerTransaction({ t, transaction, fnName: 'SayHello' })
    assertServerMetrics({ t, agentMetrics: agent.metrics._metrics, fnName: 'SayHello' })
    t.end()
  })

  t.test('should add DT headers when `distributed_tracing` is enabled', async (t) => {
    let serverTransaction
    let clientTransaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayHello')) {
        serverTransaction = tx
      }
    })

    await helper.runInTransaction(agent, 'web', async (tx) => {
      clientTransaction = tx
      clientTransaction.name = 'clientTransaction'
      const response = await makeUnaryRequest({
        client,
        fnName: 'sayHello',
        payload: { name: 'New Relic' }
      })
      t.ok(response, 'response exists')
      tx.end()
    })

    assertDistributedTracing({ t, clientTransaction, serverTransaction })
    t.end()
  })

  t.test(
    'should not include distributed trace headers when there is no client transaction',
    async (t) => {
      let serverTransaction
      agent.on('transactionFinished', (tx) => {
        serverTransaction = tx
      })
      const payload = { name: 'dt not in transaction' }
      const response = await makeUnaryRequest({ client, fnName: 'sayHello', payload })
      t.ok(response, 'response exists')
      const attributes = serverTransaction.trace.attributes.get(DESTINATION)
      t.notHas(attributes, 'request.header.newrelic', 'should not have newrelic in headers')
      t.notHas(attributes, 'request.header.traceparent', 'should not have traceparent in headers')
    }
  )

  t.test('should not add DT headers when `distributed_tracing` is disabled', async (t) => {
    let serverTransaction
    let clientTransaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayHello')) {
        serverTransaction = tx
      }
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
      t.ok(response, 'response exists')
      tx.end()
    })

    const attributes = serverTransaction.trace.attributes.get(DESTINATION)
    t.notHas(attributes, 'request.header.newrelic', 'should not have newrelic in headers')
    t.notHas(attributes, 'request.header.traceparent', 'should not have traceparent in headers')
    t.end()
  })

  const errorsEnabled = [true, false]
  errorsEnabled.forEach((enabled) => {
    t.test(
      `should ${enabled ? '' : 'not '}record errors if 'grpc.record_errors' is ${
        enabled ? 'enabled' : 'disabled'
      }`,
      async (t) => {
        agent.config.grpc.record_errors = enabled
        const expectedStatusCode = ERR_CODE
        const expectedStatusText = ERR_SERVER_MSG
        let transaction
        agent.on('transactionFinished', (tx) => {
          if (tx.name === getServerTransactionName('SayError')) {
            transaction = tx
          }
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
          t,
          transaction,
          errors: agent.errors,
          agentMetrics: agent.metrics._metrics,
          expectErrors: enabled,
          expectedStatusCode,
          expectedStatusText,
          fnName: 'SayError'
        })
        t.end()
      }
    )
  })
})
