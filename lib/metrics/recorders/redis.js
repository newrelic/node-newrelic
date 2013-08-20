'use strict';

var path  = require('path')
  , REDIS = require(path.join(__dirname, '..', 'names')).REDIS
  ;

function recordRedis(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , rollupType  = transaction.isWeb() ? REDIS.WEB : REDIS.OTHER
    ;

  if (scope) transaction.measure(segment.name, scope, duration, exclusive);

  transaction.measure(segment.name, null, duration, exclusive);
  transaction.measure(rollupType,   null, duration, exclusive);
  transaction.measure(REDIS.ALL,    null, duration, exclusive);
}

module.exports = recordRedis;
