/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const DatastoreShim = require('#agentlib/shim/datastore-shim.js')
const { OperationSpec, QuerySpec } = require('#agentlib/shim/specs/index.js')

const TestDatastore = require('./test-datastore')

function makeSuite(name) {
  return benchmark.createBenchmark({ name, runs: 10000 })
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
        query
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
