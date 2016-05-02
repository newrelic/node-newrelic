'use strict'

var DatastoreShim = require('../shim/datastore-shim')

module.exports = function initialize(agent, _cassandra) {
  // TODO:  The exported function should change to `instrumenter` below once we
  //        move this instrumentation to its own module.

  (function instrumenter(shim, cassandra) {
    var proto = cassandra.Client.prototype
    shim.recordOperation(proto, ['connect', 'shutdown'], {callback: shim.LAST})
    shim.recordQuery(proto, '_innerExecute', {query: shim.FIRST, callback: shim.LAST})
    shim.recordBatchQuery(proto, 'batch', {
      query: findBatchQueryArg,
      callback: shim.LAST
    })
  }(new DatastoreShim(agent, DatastoreShim.CASSANDRA), _cassandra))
}

/**
 * Given the arguments for Cassandra's `batch` method, this finds the first
 * query in the batch.
 *
 * @return {string} The query for this batch request.
 */
function findBatchQueryArg(shim, batch, fnName, args) {
  var sql = (args[0] && args[0][0]) || ''
  return sql.query || sql
}
