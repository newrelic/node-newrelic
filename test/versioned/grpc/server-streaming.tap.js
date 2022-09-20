/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT
const { ERR_CODE, ERR_SERVER_MSG } = require('./constants.cjs')

const {
  makeServerStreamingRequest,
  createServer,
  getClient,
  getServerTransactionName,
  assertError,
  assertServerTransaction,
  assertServerMetrics,
  assertDistributedTracing
} = require('./util.cjs')

tap.test('gRPC Server: Server Streaming', (t) => {
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

  t.test('should track server-streaming requests', async (t) => {
    let transaction
    agent.on('transactionFinished', (tx) => {
      transaction = tx
    })

    const names = ['Bob', 'Jordi', 'Corey']
    const responses = await makeServerStreamingRequest({
      client,
      fnName: 'sayHelloServerStream',
      payload: { name: names }
    })
    names.forEach((name, i) => {
      t.equal(responses[i], `Hello ${name}`, 'response stream message should be correct')
    })
    t.ok(transaction, 'transaction exists')
    assertServerTransaction({ t, transaction, fnName: 'SayHelloServerStream' })
    assertServerMetrics({ t, agentMetrics: agent.metrics._metrics, fnName: 'SayHelloServerStream' })
    t.end()
  })

  t.test('should add DT headers when `distributed_tracing` is enabled', async (t) => {
    let serverTransaction
    let clientTransaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayHelloServerStream')) {
        serverTransaction = tx
      }
    })
    const payload = { name: ['dt test', 'dt test 2'] }
    await helper.runInTransaction(agent, 'web', async (tx) => {
      clientTransaction = tx
      clientTransaction.name = 'clientTransaction'
      await makeServerStreamingRequest({ client, fnName: 'sayHelloServerStream', payload })
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
      const payload = { name: ['dt test', 'dt test 2'] }
      await makeServerStreamingRequest({ client, fnName: 'sayHelloServerStream', payload })
      const attributes = serverTransaction.trace.attributes.get(DESTINATION)
      t.notHas(attributes, 'request.header.newrelic', 'should not have newrelic in headers')
      t.notHas(attributes, 'request.header.traceparent', 'should not have traceparent in headers')
    }
  )

  t.test('should not add DT headers when `distributed_tracing` is disabled', async (t) => {
    let serverTransaction
    let clientTransaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayHelloServerStream')) {
        serverTransaction = tx
      }
    })

    agent.config.distributed_tracing.enabled = false
    await helper.runInTransaction(agent, 'web', async (tx) => {
      clientTransaction = tx
      clientTransaction.name = 'clientTransaction'
      const payload = { name: ['dt test', 'dt test 2'] }
      await makeServerStreamingRequest({ client, fnName: 'sayHelloServerStream', payload })
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
        const expectedStatusCode = ERR_CODE
        const expectedStatusText = ERR_SERVER_MSG
        agent.config.grpc.record_errors = enabled
        let transaction
        agent.on('transactionFinished', (tx) => {
          if (tx.name === getServerTransactionName('SayErrorServerStream')) {
            transaction = tx
          }
        })

        try {
          const payload = { name: ['noes'] }
          await makeServerStreamingRequest({ client, fnName: 'sayErrorServerStream', payload })
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
          fnName: 'SayErrorServerStream'
        })
        t.end()
      }
    )
  })
})
