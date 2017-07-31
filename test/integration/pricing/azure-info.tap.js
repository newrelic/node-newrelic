'use strict'

var tap = require('tap')


tap.test('pricing azure info', function(t) {
  require('./vendor-info-tests')(t, 'azure')
})
