'use strict'

function record(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    

  if (scope) transaction.measure(segment.name, scope, duration, exclusive)

  transaction.measure(segment.name, null, duration, exclusive)
}

module.exports = record
