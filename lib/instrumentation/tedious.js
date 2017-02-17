'use strict'

var shimmer = require('../shimmer')
var parseSql = require('../db/parse-sql')
var MSSQL = require('../metrics/names').MSSQL

module.exports = function initialize(agent, tedious) {
  var tracer = agent.tracer

  shimmer.wrapMethod(
    tedious && tedious.Connection && tedious.Connection.prototype,
    'tedious.Connection.prototype',
    'makeRequest',
    function nrMakeRequestWrapper(original) {
      return tracer.wrapFunction(
        MSSQL.STATEMENT + 'Unknown',
        null,
        original,
        wrapRequest
      )
    }
  )

  function wrapRequest(segment, args, bind) {
    var transaction = tracer.getTransaction()
    var request = args[0]
    var payload = args[2]

    // Attempt to get the statement, this probably only works for `execSql`
    var statement = payload.request.parametersByName &&
      payload.request.parametersByName.statement &&
      payload.request.parametersByName.statement.value || ''

    var ps = parseSql(MSSQL.PREFIX, statement)
    transaction.addRecorder(ps.recordMetrics.bind(ps, segment))
    segment.name = MSSQL.STATEMENT + (ps.model || 'unknown') + '/' + ps.operation

    // capture connection info for datastore instance metric
    segment.port = this.config.options.port
    segment.host = this.config.server

    // find and wrap the callback
    if (typeof request.userCallback === 'function') {
      request.userCallback = bind(request.userCallback)
    }

    return args
  }
}
