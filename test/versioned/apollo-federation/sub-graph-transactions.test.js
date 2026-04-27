/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { executeQuery } = require('../../lib/apollo/test-client')
const { setupFederatedGateway, teardownGateway } = require('./federated-gateway-server-setup')
const { checkResult } = require('../../lib/apollo/common')

test('apollo-federation: sub graph transaction naming ', async (t) => {
  t.beforeEach(async (ctx) => {
    await setupFederatedGateway({ ctx, instrumentSubGraphs: true })
  })

  t.afterEach(async (ctx) => {
    await teardownGateway({ ctx })
  })

  await t.test('should properly name when inline fragments exist', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    /**
     * This query gets deconstructed as such
     * `{libraries{branch __typename id}}`
     * `query($representations:[_Any!]!){
     *    _entities(representations:$representations){
     *      ...on Library{
     *        booksInStock{
     *          isbn title author
     *        }
     *      }
     *    }
     *  }`
     * `query($representations:[_Any!]!){
     *   _entities(representations:$representations){
     *     ...on Library{
     *       magazinesInStock{
     *         issue title
     *       }
     *     }
     *   }
     * }`
     * The ones with `...on Library` are [InlineFragments](https://graphql.org/learn/queries/#inline-fragments)
     * which lack name properties on all the selections within document.
     * Without the fix in https://github.com/newrelic/newrelic-node-apollo-server-plugin/pull/100
     * they would crash and not properly name the transactions, also the query request
     * would fail.
     */
    const query = `query SubGraphs {
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

    const transactions = []
    const expectedTransactions = [
      /WebTransaction\/Nodejs\/POST\/\/query\/SubGraphs__Library__\d+\/libraries.branch/,
      /WebTransaction\/Nodejs\/POST\/\/query\/SubGraphs__Book__\d+\/_entities<Library>.booksInStock/,
      /WebTransaction\/Nodejs\/POST\/\/query\/SubGraphs__Magazine__\d+\/_entities<Library>.magazinesInStock/,
      /WebTransaction\/Nodejs\/POST\/\/query\/SubGraphs\/libraries/
    ]

    agent.on('transactionFinished', (transaction) => {
      transactions.push(transaction.name)
    })

    executeQuery(serverUrl, query, (err, result) => {
      assert.equal(transactions.length, 4, 'should create 4 transactions')
      const transactionMatches = transactions.filter((transaction) => expectedTransactions.some((expectedTransaction) => transaction.match(expectedTransaction)))
      assert.equal(transactionMatches.length, 4, 'transactions should match proper names')

      assert.ok(!err)
      checkResult(assert, result, () => {
        end()
      })
    })
  })

  await t.test('should filter id and __typename fields from unique naming', (t, end) => {
    const { agent, gatewayService } = t.nr
    const serverUrl = gatewayService.url

    /**
     * The 'libraries' sub graph service gets queried as:
     * query {
     *   libraries {
     *     branch
     *     __typename
     *     id
     *   }
     * }
     *
     * 'id' and '__typename' should get filtered out for a
     * specific name of 'libraries.branch'.
     */
    const query = `query SubGraphs {
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

    const transactions = []
    const expectedPath = 'libraries.branch'
    const expectedTransaction = `WebTransaction/Nodejs/POST//query/SubGraphs__Library__0/${expectedPath}`

    agent.on('transactionFinished', (transaction) => {
      transactions.push(transaction.name)
    })

    executeQuery(serverUrl, query, (err, result) => {
      const hasTransaction = transactions.indexOf(expectedTransaction) >= 0

      assert.ok(hasTransaction, `should have a transaction named: '${expectedTransaction}'`)

      assert.ok(!err)
      checkResult(assert, result, () => {
        end()
      })
    })
  })
})
