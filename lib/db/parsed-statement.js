"use strict";

function ParsedStatement(operation, model) {
  this.recordMetrics = function (transaction, scope, timer) {
    var name = 'Database/' + model + '/' + operation;
    transaction.measure(name, scope).setDurationInMillis(timer.getDurationInMillis());
    transaction.measure(name).setDurationInMillis(timer.getDurationInMillis());
    transaction.measure('Database/' + operation).setDurationInMillis(timer.getDurationInMillis());
    transaction.measure('Database/all').setDurationInMillis(timer.getDurationInMillis());

    var kind = 'Other';
    if (transaction.isWeb()) kind = 'Web';

    transaction.measure('Database/all/' + kind).setDurationInMillis(timer.getDurationInMillis());
  };
}

module.exports = ParsedStatement;
