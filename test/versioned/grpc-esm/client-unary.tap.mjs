/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import helper from '../../lib/agent_helper.js'
import { default as constants } from '../grpc/constants.cjs'
const { ERR_CODE, ERR_MSG } = constants
import { default as utils } from '../grpc/util.cjs'

const {
  assertError,
  assertExternalSegment,
  assertMetricsNotExisting,
  makeUnaryRequest,
  createServer,
  getClient
} = utils

tap.test('gRPC Client: Unary Requests', (t) => {
  t.autoend()

  let agent
  let client
  let server
  let proto
  let grpc

  t.before(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = await import('@grpc/grpc-js')
    const data = await createServer(grpc)
    proto = data.proto
    server = data.server
    client = getClient(grpc, proto)
  })

  t.afterEach(() => {
    agent.errors.traceAggregator.clear()
    agent.metrics.clear()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
    server.forceShutdown()
    client.close()
    grpc = null
    proto = null
  })

  t.test('should track unary client requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      tx.name = 'clientTransaction'
      function transactionFinished(transaction) {
        if (transaction.name === 'clientTransaction') {
          // Make sure we're in the client and not server transaction
          assertExternalSegment({ t, tx: transaction, fnName: 'SayHello' })
          t.end()
        }
      }
      agent.on('transactionFinished', transactionFinished)
      t.teardown(() => {
        agent.removeListener('transactionFinished', transactionFinished)
      })
      const response = await makeUnaryRequest({
        client,
        fnName: 'sayHello',
        payload: { name: 'New Relic' }
      })
      t.ok(response, 'response exists')
      t.equal(response.message, 'Hello New Relic', 'response message is correct')
      tx.end()
    })
  })

  t.test('should include distributed trace headers when enabled', (t) => {
    helper.runInTransaction(agent, 'dt-test', async (tx) => {
      const payload = { name: 'dt test' }
      await makeUnaryRequest({ client, fnName: 'sayHello', payload })
      const dtMeta = server.metadataMap.get(payload.name)
      t.match(
        dtMeta.get('traceparent')[0],
        /^[\w\d\-]{55}$/,
        'should have traceparent in server metadata'
      )
      t.equal(dtMeta.get('newrelic')[0], '', 'should have newrelic in server metadata')
      tx.end()
      t.end()
    })
  })

  t.test('should not include distributed trace headers when not in transaction', async (t) => {
    const payload = { name: 'dt not in transaction' }
    await makeUnaryRequest({ client, fnName: 'sayHello', payload })
    const dtMeta = server.metadataMap.get(payload.name)
    t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
    t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
  })

  t.test(
    'should not include distributed trace headers when distributed_tracing.enabled is set to false',
    (t) => {
      agent.config.distributed_tracing.enabled = false
      helper.runInTransaction(agent, 'dt-test', async (tx) => {
        const payload = { name: 'dt disabled' }
        await makeUnaryRequest({ client, payload, fnName: 'sayHello' })
        const dtMeta = server.metadataMap.get(payload.name)
        t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
        t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
        tx.end()
        t.end()
      })
    }
  )

  t.test('should not track external unary client requests outside of a transaction', async (t) => {
    const payload = { name: 'New Relic' }
    const response = await makeUnaryRequest({ client, fnName: 'sayHello', payload })
    t.ok(response, 'response exists')
    t.equal(response.message, 'Hello New Relic', 'response message is correct')
    assertMetricsNotExisting({ t, agent })
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
    t.test(testName, (t) => {
      const expectedStatusText = ERR_MSG
      const expectedStatusCode = ERR_CODE
      agent.config.grpc.record_errors = config.should
      helper.runInTransaction(agent, 'web', async (tx) => {
        tx.name = 'clientTransaction'
        function transactionFinished(transaction) {
          if (transaction.name === 'clientTransaction') {
            assertError({
              t,
              transaction,
              errors: agent.errors,
              expectErrors: config.should,
              expectedStatusCode,
              expectedStatusText,
              fnName: 'SayError',
              clientError: true
            })
            t.end()
          }
        }

        agent.on('transactionFinished', transactionFinished)
        t.teardown(() => {
          agent.removeListener('transactionFinished', transactionFinished)
        })

        try {
          const payload = { oh: 'noes' }
          await makeUnaryRequest({ client, fnName: 'sayError', payload })
        } catch (err) {
          t.ok(err, 'should get an error')
          t.equal(err.code, expectedStatusCode, 'should get the right status code')
          t.equal(err.details, expectedStatusText, 'should get the correct error message')
          tx.end()
        }
      })
    })
  })

  t.test('should bind callback to the proper transaction context', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      client.sayHello({ name: 'Callback' }, (err, response) => {
        t.ok(response)
        t.equal(response.message, 'Hello Callback')
        t.ok(agent.getTransaction(), 'callback should have transaction context')
        t.equal(agent.getTransaction(), tx, 'transaction should be the one we started with')
        t.end()
      })
    })
  })
})
