'use strict'

var path = require('path')
  , DB   = require('../metrics/names').DB
  

function ParsedStatement(type, operation, model) {
  this.type      = type
  this.operation = operation
  this.model     = model
}

ParsedStatement.prototype.recordMetrics = function recordMetrics(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , type        = transaction.isWeb() ? DB.WEB : DB.OTHER
    , operation   = DB.OPERATION + '/' + this.type + '/' + this.operation
    

  // If we can parse the SQL statement, create a 'statement' metric, and use it
  // as the scoped metric for transaction breakdowns. Otherwise, skip the
  // 'statement' metric and use the 'operation' metric as the scoped metric for
  // transaction breakdowns.
  if (this.model) {
    var model = DB.STATEMENT + '/' + this.type + '/' + this.model + '/' +
                this.operation

    transaction.measure(model, null, duration, exclusive)
    if (scope) transaction.measure(model, scope, duration, exclusive)
  } else {
    if (scope) transaction.measure(operation, scope, duration, exclusive)
  }

  transaction.measure(operation, null, duration, exclusive)
  transaction.measure(type,      null, duration, exclusive)
  transaction.measure(DB.ALL,    null, duration, exclusive)

  if (segment.port > 0) {
    var hostname = segment.host || 'localhost'
      , location = hostname + ':' + segment.port
      , instance = DB.INSTANCE + '/' + this.type + '/' + location
      

    transaction.measure(instance, null, duration, exclusive)
  }
}

module.exports = ParsedStatement
