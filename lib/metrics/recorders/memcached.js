'use strict';

var path     = require('path')
  , MEMCACHE = require(path.join(__dirname, '..', 'names.js')).MEMCACHE
  ;

function recordMemcache(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , rollupType  = transaction.isWeb() ? MEMCACHE.WEB : MEMCACHE.OTHER
    ;

  if (scope) transaction.measure(segment.name, scope, duration, exclusive);

  transaction.measure(segment.name, null, duration, exclusive);
  transaction.measure(rollupType,   null, duration, exclusive);
  transaction.measure(MEMCACHE.ALL, null, duration, exclusive);
}

module.exports = recordMemcache;
