/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT
const { ERR_CODE, ERR_SERVER_MSG } = require('./constants.cjs')

const {
  makeBidiStreamingRequest,
  createServer,
  getClient,
  getServerTransactionName,
  assertError,
  assertServerTransaction,
  assertServerMetrics,
  assertDistributedTracing
} = require('./util.cjs')

tap.test('gRPC Server: Bidi Streaming', (t) => {
  t.autoend()

  let agent
  let client
  let server
  let proto
  let grpc
  let port

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = require('@grpc/grpc-js')
    ;({ port, proto, server } = await createServer(grpc))
    client = getClient(grpc, proto, port)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    server.forceShutdown()
    client.close()
    grpc = null
    proto = null
    removeModules(['@grpc/grpc-js'])
  })

  t.test('should track bidirectional requests', async (t) => {
    let transaction
    agent.on('transactionFinished', (tx) => {
      transaction = tx
    })

    const names = [{ name: 'Huey' }, { name: 'Dewey' }, { name: 'Louie' }]
    const responses = await makeBidiStreamingRequest({
      client,
      fnName: 'sayHelloBidiStream',
      payload: names
    })
    names.forEach(({ name }, i) => {
      t.equal(responses[i], `Hello ${name}`, 'response stream message should be correct')
    })

    t.ok(transaction, 'transaction exists')
    assertServerTransaction({ t, transaction, fnName: 'SayHelloBidiStream' })
    assertServerMetrics({ t, agentMetrics: agent.metrics._metrics, fnName: 'SayHelloBidiStream' })
    t.end()
  })

  t.test('should add DT headers when `distributed_tracing` is enabled', async (t) => {
    let serverTransaction
    let clientTransaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayHelloBidiStream')) {
        serverTransaction = tx
      }
    })
    const payload = [{ name: 'dt test' }]
    await helper.runInTransaction(agent, 'web', async (tx) => {
      clientTransaction = tx
      clientTransaction.name = 'clientTransaction'
      await makeBidiStreamingRequest({ client, fnName: 'sayHelloBidiStream', payload })
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
      const payload = [{ name: 'dt not in transaction' }]
      await makeBidiStreamingRequest({ client, fnName: 'sayHelloBidiStream', payload })
      const attributes = serverTransaction.trace.attributes.get(DESTINATION)
      t.notHas(attributes, 'request.header.newrelic', 'should not have newrelic in headers')
      t.notHas(attributes, 'request.header.traceparent', 'should not have traceparent in headers')
    }
  )

  t.test('should not add DT headers when `distributed_tracing` is disabled', async (t) => {
    let serverTransaction
    let clientTransaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayHelloBidiStream')) {
        serverTransaction = tx
      }
    })

    agent.config.distributed_tracing.enabled = false
    await helper.runInTransaction(agent, 'web', async (tx) => {
      clientTransaction = tx
      clientTransaction.name = 'clientTransaction'
      const payload = [{ name: 'dt disabled' }]
      await makeBidiStreamingRequest({ client, fnName: 'sayHelloBidiStream', payload })
      tx.end()
    })

    const attributes = serverTransaction.trace.attributes.get(DESTINATION)
    t.notHas(attributes, 'request.header.newrelic', 'should not have newrelic in headers')
    t.notHas(attributes, 'request.header.traceparent', 'should not have traceparent in headers')
    t.end()
  })

  const grpcConfigs = [
    { record_errors: true, ignore_status_codes: [], should: true },
    { record_errors: false, ignore_status_codes: [], should: false },
    { record_errors: true, ignore_status_codes: [9], should: false }
  ]
  grpcConfigs.forEach((config) => {
    const should = config.should ? 'should' : 'should not'
    const testName = `${should} record errors in a transaction when ignoring ${config.ignore_status_codes}`
    t.test(testName, async (t) => {
      agent.config.grpc.record_errors = config.record_errors
      agent.config.grpc.ignore_status_codes = config.ignore_status_codes
      const expectedStatusCode = ERR_CODE
      const expectedStatusText = ERR_SERVER_MSG
      let transaction
      agent.on('transactionFinished', (tx) => {
        if (tx.name === getServerTransactionName('SayErrorBidiStream')) {
          transaction = tx
        }
      })

      try {
        const payload = [{ name: 'server-error' }]
        await makeBidiStreamingRequest({ client, fnName: 'sayErrorBidiStream', payload })
      } catch (err) {
        // err tested in client tests
      }

      assertError({
        t,
        transaction,
        errors: agent.errors,
        agentMetrics: agent.metrics._metrics,
        expectErrors: config.should,
        expectedStatusCode,
        expectedStatusText,
        fnName: 'SayErrorBidiStream'
      })
      t.end()
    })
  })
})
