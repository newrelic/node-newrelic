'use strict';

var path = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

module.exports = function initialize(agent, trace, mysql) {
  var Client = mysql.Client;
  var db = require('../legacy/database');

  shimmer.wrapMethod(Client.prototype, 'mysql.Client.prototype', 'query', function (original) {
    return function (sql, callback) {
      var tx = agent.getTransaction();

      if (!tx) return original.apply(this, arguments);

      var ps = db.parseSql(sql);
      var tracer = new trace.createTracer(agent, ps.recordMetrics);
      tracer.sql = sql;
      var wrapper = function () {
        tracer.finish();
        callback.apply(this, arguments);
      };

      return original.apply(this, [sql, wrapper]);
    };
  });
};
