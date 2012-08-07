'use strict';

function ParsedStatement(operation, model) {
  this.operation = operation;
  this.model     = model;
}

ParsedStatement.prototype.recordMetrics = function (transaction, scope, timer) {
  var name = 'Database/' + this.model + '/' + this.operation;
  transaction.measure(name, scope).setDurationInMillis(timer.getDurationInMillis());
  transaction.measure(name).setDurationInMillis(timer.getDurationInMillis());
  transaction.measure('Database/' + this.operation).setDurationInMillis(timer.getDurationInMillis());
  transaction.measure('Database/all').setDurationInMillis(timer.getDurationInMillis());

  var kind = 'Other';
  if (transaction.isWeb && transaction.isWeb()) kind = 'Web';

  transaction.measure('Database/all/' + kind).setDurationInMillis(timer.getDurationInMillis());
};

module.exports = ParsedStatement;
