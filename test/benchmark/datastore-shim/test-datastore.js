'use strict'

class TestDatastore {
  testOp(cb) {
    setImmediate(cb)
  }

  testQuery(query, cb) {
    setImmediate(cb)
  }

  testBatch(query, cb) {
    setImmediate(cb)
  }
}

module.exports = TestDatastore
