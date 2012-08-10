'use strict';

var path = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

exports.initialize = function (agent, trace, mysql) {
  var Client = mysql.Client;
  var db = require('../database');

  var query = shimmer.preserveMethod(Client.prototype, 'query');
  Client.prototype.query = function (sql, callback) {
    var tx = agent.getTransaction();
    if (!tx) return query.apply(this, arguments);

    var ps = db.parseSql(sql);
    var tracer = new trace.createTracer(agent, ps.recordMetrics);
    tracer.sql = sql;
    var wrapper = function () {
      tracer.finish();
      callback.apply(this, arguments);
    };

    return query.apply(this, [sql, wrapper]);
  };
};
