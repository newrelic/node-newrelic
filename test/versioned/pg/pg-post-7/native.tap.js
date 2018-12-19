'use strict'

var runTests = require('./pg.common.js')

runTests('native', function getClient() {
  return require('pg').native
})
