'use strict'

var DB = require('../metrics/names').DB
var ALL = require('../metrics/names').ALL
var hasOwnProperty = require('../util/properties').hasOwn


function ParsedStatement(type, operation, collection, raw) {
  this.type = type
  this.operation = operation
  this.collection = collection
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
  var thisTypeSlash = this.type + '/'
  var operation = DB.OPERATION + '/' + thisTypeSlash + this.operation

  // Rollups
  transaction.measure(operation, null, duration, exclusive)
  transaction.measure(DB.PREFIX + type, null, duration, exclusive)
  transaction.measure(DB.PREFIX + thisTypeSlash + type, null, duration, exclusive)
  transaction.measure(DB.PREFIX + thisTypeSlash + ALL, null, duration, exclusive)
  transaction.measure(DB.ALL, null, duration, exclusive)

  // If we can parse the SQL statement, create a 'statement' metric, and use it
  // as the scoped metric for transaction breakdowns. Otherwise, skip the
  // 'statement' metric and use the 'operation' metric as the scoped metric for
  // transaction breakdowns.
  if (this.collection) {
    var collection =
      DB.STATEMENT + '/' + thisTypeSlash + this.collection + '/' + this.operation
    transaction.measure(collection, null, duration, exclusive)
    if (scope) {
      transaction.measure(collection, scope, duration, exclusive)
    }
  } else if (scope) {
    transaction.measure(operation, scope, duration, exclusive)
  }

  // This recorder is side-effectful Because we are depending on the recorder
  // setting the transaction name, recorders must always be run before generating
  // the final transaction trace
  segment.name = collection || operation

  // Datastore instance metrics.
  if (
    hasOwnProperty(segment.parameters, 'host') &&
    hasOwnProperty(segment.parameters, 'port_path_or_id')
  ) {
    var instanceName = DB.INSTANCE + '/' + thisTypeSlash + segment.parameters.host +
      '/' + segment.parameters.port_path_or_id
    transaction.measure(instanceName, null, duration, exclusive)
  }

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
