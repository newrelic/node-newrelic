'use strict'

function TestDatastore() {}

TestDatastore.prototype.testOp = function testOp(cb) {
  setImmediate(cb)
}
TestDatastore.prototype.testQuery = function testQuery(query, cb) {
  setImmediate(cb)
}
TestDatastore.prototype.testBatch  = function testBatch(query, cb) {
  setImmediate(cb)
}

module.exports = TestDatastore
