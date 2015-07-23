'use strict'

require('../../../index.js')
process.on('message', function (code) {
  throw new Error(code)
})

// register a uncaughtException handler of our own
process.on('uncaughtException', function (e) {
  process.send(e.message)
})
