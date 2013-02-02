'use strict';

function ParsedStatement(operation, model) {
  this.operation = operation;
  this.model     = model;
}

ParsedStatement.prototype.recordMetrics = function (segment, scope) {
  var duration    = segment.getDurationInMillis()
    , transaction = segment.trace.transaction
    , byModel     = 'Database/' + this.model + '/' + this.operation
    ;

  [ 'Database/all',
    'Database/all/' + (transaction.isWeb() ? 'Web' : 'Other'),
    'Database/' + this.operation,
    byModel
  ].forEach(function (m) { transaction.measure(m, null, duration); });

  if (scope) transaction.measure(byModel, scope, duration);
};

module.exports = ParsedStatement;
