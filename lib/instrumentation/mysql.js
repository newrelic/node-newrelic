'use strict';

var path     = require('path')
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  ;

module.exports = function initialize(agent, mysql) {
  shimmer.wrapMethod(mysql.Client.prototype, 'mysql.Client.prototype', 'query', function (original) {
    return function (sql, callback) {
      var state = agent.getState();
      if (!state) return original.apply(this, arguments);

      var ps = parseSql(sql);
      var segment = state.getSegment().add(null, ps.recordMetrics);
      var wrapper = agent.tracer.callbackProxy(function () {
        segment.end();
        callback.apply(this, arguments);
      });

      return original.call(this, sql, wrapper);
    };
  });
};
