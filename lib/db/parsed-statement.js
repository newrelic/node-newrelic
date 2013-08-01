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
    , byModel     = DB.PREFIX + this.model + '/' + this.operation
    ;

  [ DB.ALL,
    transaction.isWeb() ? DB.WEB : DB.OTHER,
    DB.PREFIX + this.operation,
    byModel
  ].forEach(function (m) { transaction.measure(m, null, duration); });

  if (scope) transaction.measure(byModel, scope, duration);
};

module.exports = ParsedStatement;
