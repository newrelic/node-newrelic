'use strict';

var path  = require('path')
  , NAMES = require(path.join(__dirname, '..', 'names'))
  , DB    = NAMES.DB
  , CASSANDRA = NAMES.CASSANDRA
  ;

function record(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , type        = transaction.isWeb() ? DB.WEB : DB.OTHER
    , operation   = segment.name
    ;

  if (scope) transaction.measure(operation, scope, duration, exclusive);

  transaction.measure(operation, null, duration, exclusive);
  transaction.measure(type,      null, duration, exclusive);
  transaction.measure(DB.ALL,    null, duration, exclusive);

  if (segment.port > 0) {
    var hostname = segment.host || 'localhost'
      , location = hostname + ':' + segment.port
      , instance = DB.INSTANCE + '/' + CASSANDRA.PREFIX + '/' + location
      ;

    transaction.measure(instance, null, duration, exclusive);
  }
}

module.exports = record;
