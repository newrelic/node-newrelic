'use strict'

function extractSqlFromTediousRequest(shim, original, name, args) {
  var request = args[0]

  if (request.parametersByName.statement && request.parametersByName.statement.value) {
    return request.parametersByName.statement.value
  }

  return request.sqlTextOrProcedure;
}

function bindSegmentRequestCallback(shim, opFunc, opName, segment, args) {
  var request = args[0];
  request.callback = shim.bindSegment(request.callback, segment)
}

module.exports = function initialize(agent, tedious, moduleName, shim) {
  shim.setDatastore(shim.MSSQL)

  var proto = tedious && tedious.Connection && tedious.Connection.prototype

  if (!proto) {
    return
  }

  shim.recordQuery(proto, 'makeRequest', function recordMakeRequest() {
    return {
      callback: bindSegmentRequestCallback,
      query: extractSqlFromTediousRequest,
    }
  })

  var transactionOperations = [
    'beginTransaction',
    'commitTransaction',
    'rollbackTransaction',
    'saveTransaction',
    'transaction'
  ]

  shim.recordOperation(proto, transactionOperations, {callback: shim.FIRST})

  var connectionOperations = [
    'cancel',
    'close',
    'reset'
  ]

  shim.recordOperation(proto, connectionOperations)
}
