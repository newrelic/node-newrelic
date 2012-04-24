exports.initialize = function (agent, trace, mysql) {
  var Client = mysql.Client;
  var db = require('../database');

  var _query = Client.prototype.query;
  Client.prototype.query = function (sql, callback) {
    var tx = agent.getTransaction();
    if (!tx) return _query.apply(this, arguments);

    var ps = db.parseSql(sql);
    var tracer = new trace.Tracer(tx, ps.recordMetrics);
    tracer.sql = sql;
    var wrapper = function () {
      tracer.finish();
      callback.apply(this, arguments);
    };

    return _query.apply(this, [sql, wrapper]);
  };
};
