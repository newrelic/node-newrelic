'use strict'

var INSTRUMENTED_OPERATIONS = [
  'execute',
  'executeAsPrepared',
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
      var extras = {
        port_path_or_id: this.port,
        host: this.host
      }

      return {
        name: name,
        callback: shim.LAST,
        extras: extras
      }
    }
  )
}
