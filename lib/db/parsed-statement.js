'use strict';

function ParsedStatement(operation, model) {
  this.operation = operation;
  this.model     = model;
}

ParsedStatement.prototype.recordMetrics = function (transaction, scope, timer) {
  timer.end();
  var duration = timer.getDurationInMillis();

  var name = 'Database/' + this.model + '/' + this.operation;
  if (scope) transaction.measure(name,             scope, duration);
  transaction.measure(name,                         null, duration);
  transaction.measure('Database/' + this.operation, null, duration);
  transaction.measure('Database/all',               null, duration);

  var kind = transaction.isWeb() ? 'Web' : 'Other';
  transaction.measure('Database/all/' + kind,       null, duration);
};

module.exports = ParsedStatement;
