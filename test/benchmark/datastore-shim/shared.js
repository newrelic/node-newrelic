/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const { OperationSpec, QuerySpec } = require('../../../lib/shim/specs')

const TestDatastore = require('./test-datastore')

function makeSuite(name) {
  return benchmark.createBenchmark({ name: name, runs: 10000 })
}

function getTestDatastore(agent, instrumented) {
  const testDatastore = new TestDatastore()
  if (instrumented) {
    const shim = new DatastoreShim(agent, 'Test', 'Test')
    shim.setDatastore('test')
    shim.setParser((query) => {
      return {
        collection: 'test',
        operation: 'test',
        query: query
      }
    })

    shim.recordOperation(
      testDatastore,
      'testOp',
      new OperationSpec({
        name: 'testOp',
        callback: shim.LAST
      })
    )

    shim.recordQuery(
      testDatastore,
      'testQuery',
      new QuerySpec({
        name: 'testQuery',
        callback: shim.LAST
      })
    )

    shim.recordBatchQuery(
      testDatastore,
      'testBatch',
      new QuerySpec({
        name: 'testBatch',
        callback: shim.LAST
      })
    )
  }
  return testDatastore
}

exports.makeSuite = makeSuite
exports.getTestDatastore = getTestDatastore
