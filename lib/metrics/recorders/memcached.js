'use strict';

var path     = require('path')
  , MEMCACHE = require(path.join(__dirname, '..', 'names.js')).MEMCACHE
  ;

function recordMemcache(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    ;

  if (scope) transaction.measure(segment.name, scope, duration, exclusive);

  transaction.measure(segment.name, null, duration, exclusive);
  transaction.measure(MEMCACHE.ALL, null, duration, exclusive);
  transaction.measure(MEMCACHE.WEB, null, duration, exclusive);
}

module.exports = recordMemcache;
