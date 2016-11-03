'use strict'

var runTests = require('./pg.common.js')

runTests('pure JavaScript', function getClient() {
  return require('pg')
})
