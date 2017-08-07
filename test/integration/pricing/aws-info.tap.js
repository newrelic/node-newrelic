'use strict'

var tap = require('tap')


tap.test('pricing aws info', function(t) {
  require('./vendor-info-tests')(t, 'aws')
})
