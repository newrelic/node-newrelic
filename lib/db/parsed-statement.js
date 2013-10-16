'use strict';

var path = require('path')
  , DB   = require(path.join(__dirname, '..', 'metrics', 'names')).DB
  ;

function ParsedStatement(type, operation, model) {
  this.type      = type;
  this.operation = operation;
  this.model     = model;
}

ParsedStatement.prototype.recordMetrics = function (segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , type        = transaction.isWeb() ? DB.WEB : DB.OTHER
    , operation   = DB.OPERATION + '/' + this.type + '/' + this.operation
    , model       = DB.STATEMENT + '/' + this.type +
                      '/' + this.model + '/' + this.operation
    ;

  if (scope) transaction.measure(model, scope, duration, exclusive);

  transaction.measure(model,     null, duration, exclusive);
  transaction.measure(operation, null, duration, exclusive);
  transaction.measure(type,      null, duration, exclusive);
  transaction.measure(DB.ALL,    null, duration, exclusive);

  if (segment.port > 0) {
    var hostname = segment.host || 'localhost'
      , location = hostname + ':' + segment.port
      , instance = DB.INSTANCE + '/' + this.type + '/' + location
      ;

    transaction.measure(instance, null, duration, exclusive);
  }
};

module.exports = ParsedStatement;
