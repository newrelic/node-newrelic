/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { setupFederatedGateway, teardownGateway } = require('./federated-gateway-server-setup')
const { executeQuery } = require('../../lib/apollo/test-client')
const { checkResult } = require('../../lib/apollo/common')
const { findSegment } = require('../../lib/metrics_helper')
const SEGMENT_DESTINATION = 0x20
const ANON_PLACEHOLDER = '<anonymous>'
const QUERY_ATTRIBUTE_NAME = 'graphql.operation.query'
const OPERATION_PREFIX = 'GraphQL/operation/ApolloServer/query'

test('apollo-federation: query obfuscation', async (t) => {
  t.beforeEach(async (ctx) => {
    await setupFederatedGateway({ ctx })
  })

  t.afterEach(async (ctx) => {
    await teardownGateway({ ctx })
  })

  await t.test('Obfuscates query arguments', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    const query = `query {
      library(id: 3) {
        booksInStock {
          title
        }
      }
    }`

    const path = 'library.booksInStock.title'

    let tx
    agent.on('transactionFinished', (transaction) => {
      tx = transaction
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.ok(!err)
      const operationName = `${OPERATION_PREFIX}/${ANON_PLACEHOLDER}/${path}`
      const operationSegment = findSegment(tx.trace, tx.trace.root, operationName)

      // only test one operation segment of three federated server transactions
      if (operationSegment) {
        const operationAttributes = operationSegment.attributes.get(SEGMENT_DESTINATION)

        assert.ok(operationAttributes[QUERY_ATTRIBUTE_NAME].includes('library(***)') > 0)
      }
      checkResult(assert, result, () => {
        end()
      })
    })
  })
})
