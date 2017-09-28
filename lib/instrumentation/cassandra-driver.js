'use strict'

module.exports = function initialize(agent, cassandra, moduleName, shim) {
  var proto = cassandra.Client.prototype
  shim.setDatastore(shim.CASSANDRA)
  shim.recordOperation(proto, ['connect', 'shutdown'], {callback: shim.LAST})
  shim.recordQuery(proto, '_innerExecute', {query: shim.FIRST, callback: shim.LAST})
  shim.recordBatchQuery(proto, 'batch', {
    query: findBatchQueryArg,
    callback: shim.LAST
  })
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
