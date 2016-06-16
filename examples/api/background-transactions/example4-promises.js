var newrelic = require('newrelic')

var transactionName = 'myCustomTransaction'

var invokeTransaction = newrelic.createBackgroundTransaction(transactionName,
    function() {

  // returning promise will make the invocation chainable
  return doSomeWork()
    .then(function(result) {
      newrelic.endTransaction()
    })
    .catch(function(error) {
      newrelic.noticeError(error)
      newrelic.endTransaction()
    })
})

// start the transaction
// if the transaction function returns a promise, we can continue the promise chain
invokeTransaction()
  .then(function(result) {
    console.log('done')
  })

// function to simulate async function that returns a promise
function doSomeWork() {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve(123)
    }, 500)
  })
}
