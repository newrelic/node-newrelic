'use strict'

// Create a bad log file.
var fs = require('fs')
var testLogPath = __dirname + '/test.log'
var readOnlyMode = 0x100 // => 0400 => r - -
if (!fs.existsSync(testLogPath)) {
  fs.openSync(testLogPath, 'w', readOnlyMode)
}
fs.chmodSync(testLogPath, readOnlyMode)

// Prepare to receive the error.
process.on('uncaughtException', function(err) {
  process.send({error: err, stack: err.stack})
})

// Load up new relic with the bad file.
try {
  process.env.NEW_RELIC_HOME = __dirname
  require('../../../index') // require('newrelic')
} catch (err) {
  process.send({error: err, stack: err.stack})
}

// Wait a bit then clean up and exit.
setTimeout(function() {
  fs.chmodSync(testLogPath, 0x180) // => 0600 => rw - -
  fs.unlink(testLogPath)
  process.exit(0)
}, 100)
