'use strict';

var path  = require('path')
  , NAMES = require(path.join(__dirname, '..', 'metrics', 'names'))
  , DB    = NAMES.DB
  ;

function ParsedStatement(operation, model) {
  this.operation = operation;
  this.model     = model;
}

ParsedStatement.prototype.recordMetrics = function (segment, scope) {
  var duration    = segment.getDurationInMillis()
    , transaction = segment.trace.transaction
    , type        = transaction.isWeb() ? DB.WEB : DB.OTHER
    , byModel     = DB.PREFIX + this.model + '/' + this.operation
    ;

  if (scope) transaction.measure(byModel, scope, duration);

  transaction.measure(DB.ALL,                     null, duration);
  transaction.measure(type,                       null, duration);
  transaction.measure(DB.PREFIX + this.operation, null, duration);
  transaction.measure(byModel,                    null, duration);
};

module.exports = ParsedStatement;
