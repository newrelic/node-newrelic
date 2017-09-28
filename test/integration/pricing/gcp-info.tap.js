'use strict'

var tap = require('tap')


tap.test('pricing gcp info', function(t) {
  require('./vendor-info-tests')(t, 'gcp')
})
