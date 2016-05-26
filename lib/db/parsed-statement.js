'use strict'

var DB = require('../metrics/names').DB
var ALL = require('../metrics/names').ALL

function ParsedStatement(type, operation, model, raw) {
  this.type = type
  this.operation = operation
  this.model = model
  this.trace = null
  this.raw = ''

  if (typeof raw === 'string') {
    this.trace = new Error()
    this.raw = raw
  }
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
  transaction.measure(DB.PREFIX + this.type + '/' + ALL, null, duration, exclusive)
  transaction.measure(DB.ALL, null, duration, exclusive)

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

  // This recorder is side-effectful Because we are depending on the recorder
  // setting the transaction name, recorders must always be run before generating
  // the final transaction trace
  segment.name = model || operation

  // Should not be sent until explosion issues have been resolved on the server
  // if (segment.port > 0) {
  //   var hostname = segment.host || 'localhost'
  //   var location = hostname + ':' + segment.port
  //   var instance = DB.INSTANCE + '/' + this.type + '/' + location +
  //                  '/' + this.model || 'other'

  //   transaction.measure(instance, null, duration, exclusive)
  // }

  if (this.raw) {
    transaction.agent.queries.addQuery(
      segment,
      this.type.toLowerCase(),
      this.raw,
      this.trace
    )
  }
}

module.exports = ParsedStatement
