'use strict'
var path  = require('path')
  , NAMES = require('../names')

function record(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , name        = NAMES.CUSTOM + NAMES.ACTION_DELIMITER + segment.name
    

  if (scope) transaction.measure(name, scope, duration, exclusive)

  transaction.measure(name, null, duration, exclusive)
}

module.exports = record
