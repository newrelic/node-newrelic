'use strict'

// Start with a clean slate.
var fs = require('fs')
var testLogPath = __dirname + '/test.log'
if (fs.existsSync(testLogPath)) {
  fs.unlinkSync(testLogPath)
}

// Prepare to receive any error.
process.on('uncaughtException', function(err) {
  process.send({error: err, stack: err.stack})
})

// Load up newrelic
process.env.NEW_RELIC_HOME = __dirname
require('../../../index') // require('newrelic')

// Wait a bit then check for the file.
setTimeout(function() {
  if (fs.existsSync(testLogPath)) {
    fs.unlinkSync(testLogPath)
    process.send({error: 'log file was created'})
  }

  process.exit(0)
}, 100)
