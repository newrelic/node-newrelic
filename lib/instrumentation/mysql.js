'use strict';

var path     = require('path')
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  , util = require('util')
  ;

module.exports = function initialize(agent, mysql) {
  // FIXME: need a more general way of differentiating between driver versions
  if (mysql.createConnection) {
    // congratulations, you have node-mysql 2.0
    shimmer.wrapMethod(mysql, 'mysql', 'createConnection', function (original) {
      return agent.tracer.segmentProxy(function () {
        var connection = original.apply(this, arguments);

        shimmer.wrapMethod(connection, 'connection', 'query', function (query) {
          return agent.tracer.callbackProxy(function (sql, values, callback) {
            var state = agent.getState();
            if (!state || arguments.length < 1) return query.apply(this, arguments);

            var actualSql, actualCallback;
            if (typeof sql === 'object') {
              // function (options, callback)
              actualSql = sql.sql;
              actualCallback = values;
            }
            else if (typeof values === 'function') {
              // function (sql, callback)
              actualSql = sql;
              actualCallback = values;
            }
            else {
              // function (sql, values, callback)
              actualSql = sql;
              actualCallback = callback;
            }

            var ps = parseSql(actualSql);
            var wrapped = agent.tracer.callbackProxy(actualCallback);

            var current = state.getSegment();
            var segment = current.add('Database/' + ps.model + '/' + ps.operation,
                                      ps.recordMetrics.bind(ps));
            state.setSegment(segment);

            var returned = query.call(this, sql, values, wrapped);
            return returned;
          });
        });

        return connection;
      });
    });
  }
  else if (mysql.Client) {
    // congratulations, you have node-mysql 0.9
    shimmer.wrapMethod(mysql.Client.prototype, 'mysql.Client.prototype', 'query', function (original) {
      return agent.tracer.segmentProxy(function () {
        var state = agent.getState();
        if (!state || arguments.length < 1) return original.apply(this, arguments);

        var args = Array.prototype.slice.call(arguments);
        var ps = parseSql(args[0]);

        var current = state.getSegment();
        var segment = current.add('Database/' + ps.model + '/' + ps.operation,
                                  ps.recordMetrics.bind(ps));
        state.setSegment(segment);

        // find and wrap the callback
        if (args.length > 1 && typeof(args[args.length - 1]) === 'function') {
          args[args.length - 1] = agent.tracer.callbackProxy(args[args.length - 1]);
        }

        // FIXME: need to deal with the events that will get emitted on client
        // when query is called without a callback

        // FIXME: need to grab error events as well, as they're also emitted on
        // the client

        return original.apply(this, args);
      });
    });
  }
};
