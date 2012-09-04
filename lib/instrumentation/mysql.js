'use strict';

var path     = require('path')
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  ;

module.exports = function initialize(agent, mysql) {
  shimmer.wrapMethod(mysql.Client.prototype, 'mysql.Client.prototype', 'query', function (original) {
    return function (sql, callback) {
      var trans = agent.getTransaction();
      if (!trans) return original.apply(this, arguments);

      var ps = parseSql(sql);
      var segment = trans.getTrace().add(null, ps.recordMetrics);
      var wrapper = function () {
        segment.end();
        callback.apply(this, arguments);
      };

      return original.apply(this, [sql, wrapper]);
    };
  });
};
