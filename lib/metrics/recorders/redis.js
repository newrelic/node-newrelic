'use strict';

var path  = require('path')
  , REDIS = require(path.join(__dirname, '..', 'names')).REDIS
  ;

function recordRedis(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    ;

  if (scope) transaction.measure(segment.name, scope, duration, exclusive);

  transaction.measure(segment.name, null, duration, exclusive);
  transaction.measure(REDIS.ALL,    null, duration, exclusive);
  transaction.measure(REDIS.WEB,    null, duration, exclusive);
}

module.exports = recordRedis;
