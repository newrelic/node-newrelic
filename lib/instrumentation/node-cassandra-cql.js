'use strict'

var INSTRUMENTED_OPERATIONS = [
  'execute',
  'executeAsPrepared'
]

var INSTRUMENTED_BATCH_OPERATIONS = [
  'executeBatch'
]

module.exports = function initialize(agent, cassandracql, moduleName, shim) {
  var proto =  cassandracql && cassandracql.Client && cassandracql.Client.prototype
  if (!proto) {
    return false
  }

  shim.setDatastore(shim.CASSANDRA)
  shim.recordOperation(
    proto,
    INSTRUMENTED_OPERATIONS,
    function wrapOperation(shim, original, name) {
      var parameters = {
        port_path_or_id: this.port,
        host: this.host
      }

      return {
        name: name,
        callback: shim.LAST,
        parameters: parameters
      }
    }
  )

  shim.setParser(shim.SQL_PARSER)

  shim.recordBatchQuery(
    proto,
    INSTRUMENTED_BATCH_OPERATIONS,
    function wrapOperation(shim, original, name) {
      var parameters = {
        port_path_or_id: this.port,
        host: this.host
      }

      return {
        query: function extractQueryString(client, fn, fnName, args) {
          return args[0][0].query
        },
        name: name,
        callback: shim.LAST,
        parameters: parameters
      }
    }
  )
}
