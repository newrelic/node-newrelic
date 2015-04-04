'use strict'

var DB = require('../metrics/names').DB

function ParsedStatement(type, operation, model) {
  this.type = type
  this.operation = operation
  this.model = model
}

ParsedStatement.prototype.recordMetrics = function recordMetrics(segment, scope) {
  var duration = segment.getDurationInMillis()
  var exclusive = segment.getExclusiveDurationInMillis()
  var transaction = segment.transaction
  var type = transaction.isWeb() ? DB.WEB : DB.OTHER
  var operation = DB.OPERATION + '/' + this.type + '/' + this.operation

  // Rollups
  transaction.measure(operation, null, duration, exclusive)
  transaction.measure(DB.PREFIX + type, null, duration, exclusive)
  transaction.measure(DB.PREFIX + this.type + '/' + type, null, duration, exclusive)
  transaction.measure(DB.PREFIX + this.type + '/' + DB.ALL, null, duration, exclusive)
  transaction.measure(DB.PREFIX + DB.ALL, null, duration, exclusive)

  // If we can parse the SQL statement, create a 'statement' metric, and use it
  // as the scoped metric for transaction breakdowns. Otherwise, skip the
  // 'statement' metric and use the 'operation' metric as the scoped metric for
  // transaction breakdowns.
  if (this.model) {
    var model = DB.STATEMENT + '/' + this.type + '/' + this.model + '/' +
                this.operation

    transaction.measure(model, null, duration, exclusive)
    if (scope) transaction.measure(model, scope, duration, exclusive)
  } else if (scope) {
    transaction.measure(operation, scope, duration, exclusive)
  }

  // Should not be sent until explosion issues have been resolved on the server
  // if (segment.port > 0) {
  //   var hostname = segment.host || 'localhost'
  //   var location = hostname + ':' + segment.port
  //   var instance = DB.INSTANCE + '/' + this.type + '/' + location +
  //                  '/' + this.model || 'other'

  //   transaction.measure(instance, null, duration, exclusive)
  // }
}

module.exports = ParsedStatement
