var newrelic = require('newrelic')

var transactionName = 'myCustomTransaction'

// related background transactions can be grouped in APM
// https://docs.newrelic.com/docs/apm/applications-menu/monitoring/transactions-page#txn-type-dropdown
var groupName = 'myTransactionGroup'

var invokeTransaction = newrelic.createBackgroundTransaction(transactionName, groupName,
    function() {
  // do some work
  newrelic.endTransaction()
})

// start the transaction
invokeTransaction()
