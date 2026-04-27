/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { executeQuery, executeQueryBatch } = require('../../lib/apollo/test-client')
const ANON_PLACEHOLDER = '<anonymous>'
const { setupFederatedGateway, teardownGateway } = require('./federated-gateway-server-setup')
const { checkResult, shouldSkipTransaction } = require('../../lib/apollo/common')

test('apollo-federation: transaction names', async (t) => {
  t.beforeEach(async (ctx) => {
    await setupFederatedGateway({ ctx })
  })

  t.afterEach(async (ctx) => {
    await teardownGateway({ ctx })
  })

  const TRANSACTION_PREFIX = 'WebTransaction/Nodejs/POST'

  await t.test('anonymous query, multi selections should return deepest unique path', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    const query = `query {
      libraries {
        branch
        booksInStock {
          isbn,
          title,
          author
        }
        magazinesInStock {
          issue,
          title
        }
      }
    }`

    const operationPart = `query/${ANON_PLACEHOLDER}/libraries`
    let tx

    agent.on('transactionFinished', (transaction) => {
      if (shouldSkipTransaction(transaction)) {
        return
      }
      tx = transaction
    })

    executeQuery(serverUrl, query, (_, result) => {
      assert.equal(tx.name, `${TRANSACTION_PREFIX}//${operationPart}`)
      checkResult(assert, result, () => {
        end()
      })
    })
  })

  await t.test('anonymous query, single selections should return deepest unique path', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    const query = `query {
      libraries {
        booksInStock {
          title
        }
      }
    }`

    const operationPart = `query/${ANON_PLACEHOLDER}/libraries.booksInStock.title`
    let tx
    agent.on('transactionFinished', (transaction) => {
      if (shouldSkipTransaction(transaction)) {
        return
      }
      tx = transaction
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.equal(tx.name, `${TRANSACTION_PREFIX}//${operationPart}`)
      assert.ok(!err)
      checkResult(assert, result, () => {
        end()
      })
    })
  })

  await t.test('named query, multi selections should return deepest unique path', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    const query = `query booksInStock {
      libraries {
        branch
        booksInStock {
          title,
          author
        }
      }
    }`

    const operationPart = 'query/booksInStock/libraries'
    let tx

    agent.on('transactionFinished', (transaction) => {
      if (shouldSkipTransaction(transaction)) {
        return
      }
      tx = transaction
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.equal(tx.name, `${TRANSACTION_PREFIX}//${operationPart}`)
      assert.ok(!err)
      checkResult(assert, result, () => {
        end()
      })
    })
  })

  await t.test('named query, single selections should return deepest unique path', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    const query = `query booksInStock {
      libraries {
        booksInStock {
          title
        }
      }
    }`

    const operationPart = 'query/booksInStock/libraries.booksInStock.title'
    let tx

    agent.on('transactionFinished', (transaction) => {
      if (shouldSkipTransaction(transaction)) {
        return
      }
      tx = transaction
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.equal(tx.name, `${TRANSACTION_PREFIX}//${operationPart}`)
      assert.ok(!err)
      checkResult(assert, result, () => {
        end()
      })
    })
  })

  await t.test('should properly name transaction when a named, batch federated query', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    const booksQueryName = 'GetBooksForLibraries'
    const booksQuery = `query ${booksQueryName} {
      libraries {
        booksInStock {
          isbn,
          title,
          author
        }
      }
    }`

    const magazineQueryName = 'GetMagazinesForLibraries'
    const magazineQuery = `query ${magazineQueryName} {
      libraries {
        magazinesInStock {
          issue,
          title
        }
      }
    }`

    const queries = [booksQuery, magazineQuery]

    const operationPart1 = `query/${booksQueryName}/libraries.booksInStock`
    const operationPart2 = `query/${magazineQueryName}/libraries.magazinesInStock`

    const batchTransactionPrefix = `${TRANSACTION_PREFIX}//batch`
    let tx

    agent.on('transactionFinished', (transaction) => {
      if (shouldSkipTransaction(transaction)) {
        return
      }
      tx = transaction
    })

    executeQueryBatch(serverUrl, queries, (err, result) => {
      assert.equal(tx.name, `${batchTransactionPrefix}/${operationPart1}/${operationPart2}`)
      assert.ok(!err)
      checkResult(assert, result, () => {
        assert.equal(result.length, 2)

        end()
      })
    })
  })
})
