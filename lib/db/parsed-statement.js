'use strict';

var path = require('path')
  , DB   = require(path.join(__dirname, '..', 'metrics', 'names')).DB
  ;

function ParsedStatement(operation, model) {
  this.operation = operation;
  this.model     = model;
}

ParsedStatement.prototype.recordMetrics = function (segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , type        = transaction.isWeb() ? DB.WEB : DB.OTHER
    , byModel     = DB.PREFIX + this.model + '/' + this.operation
    , dbSpecific  = segment.name
    ;

  if (scope) {
    transaction.measure(dbSpecific, scope, duration, exclusive);
    transaction.measure(byModel,    scope, duration, exclusive);
  }

  transaction.measure(dbSpecific,                 null, duration, exclusive);
  transaction.measure(byModel,                    null, duration, exclusive);
  transaction.measure(DB.PREFIX + this.operation, null, duration, exclusive);
  transaction.measure(type,                       null, duration, exclusive);
  transaction.measure(DB.ALL,                     null, duration, exclusive);
};

module.exports = ParsedStatement;
