'use strict'

var newrelic = require('newrelic')

var transactionName = 'myCustomTransaction'

// startBackgroundTransaction() takes a name, group, and a handler function to
// execute. The group is optional. The last parameter is the function performing
// the work inside the transaction. Once the transaction starts, there are
// three ways to end it:
//
// 1) Call `transaction.end()`. The `transaction` can be received by calling
//    `newrelic.getTransaction()` first thing in the handler function. Then,
//    when you call `transaction.end()` timing will stop.
// 2) Return a promise. The transaction will end when the promise resolves or
//    rejects.
// 3) Do neither. If no promise is returned, and `getTransaction()` isn't
//    called, the transaction will end immediately after the handle returns.

// Here is an example for the second case.
newrelic.startBackgroundTransaction(transactionName, function handle() {
  return doSomeWork().then(function resolve() {
    // Handle results...
  }).catch(function reject(error) {
    newrelic.noticeError(error)
    // Handle error...
  })
}).then(function afterTransaction() {
  // Note that you can continue off of the promise at this point, but the
  // transaction has ended and this work will not be associated with it.
})

// Function to simulate async function that returns a promise.
function doSomeWork() {
  return new Promise(function executor(resolve) {
    setTimeout(function work() {
      resolve(42)
    }, 500)
  })
}
