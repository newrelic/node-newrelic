'use strict'

const benchmark = require('../../lib/benchmark')
const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim')

const TestDatastore = require('./test-datastore')

function makeSuite(name) {
  var agent = helper.loadMockedAgent()
  var suite = benchmark.createBenchmark({name: name, runs: 10000})
  return {agent: agent, suite: suite}
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

    shim.recordOperation(testDatastore, 'testOp', {
      name: 'testOp',
      callback: shim.LAST
    })

    shim.recordQuery(testDatastore, 'testQuery', {
      name: 'testQuery',
      callback: shim.LAST
    })

    shim.recordBatchQuery(testDatastore, 'testBatch', {
      name: 'testBatch',
      callback: shim.LAST
    })
  }
  return testDatastore
}

exports.makeSuite = makeSuite
exports.getTestDatastore = getTestDatastore
