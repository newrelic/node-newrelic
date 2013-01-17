'use strict';

var path     = require('path')
  , logger   = require(path.join(__dirname, '..', 'logger')).child({component : 'mysql'})
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  ;

module.exports = function initialize(agent, mysql) {
  // FIXME: need a more general way of differentiating between driver versions
  if (mysql && mysql.createConnection) {
    // congratulations, you have node-mysql 2.0
    shimmer.wrapMethod(mysql, 'mysql', 'createConnection', function (createConnection) {
      return agent.tracer.segmentProxy(function () {
        var connection = createConnection.apply(this, arguments);

        shimmer.wrapMethod(connection, 'connection', 'query', function (query) {
          return agent.tracer.callbackProxy(function (sql, values, callback) {
            logger.trace("Potentially tracing node-mysql 2 query.");
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
            logger.trace("Adding node-mysql 2 query trace segment on transaction %d.",
                         state.getTransaction().id);
            state.setSegment(segment);

            var returned = query.call(this, sql, values, wrapped);
            returned.once('end', function () {
              segment.end();
              logger.trace("node-mysql 2 query trace segment finished for transaction %d.",
                           state.getTransaction().id);
            });

            return returned;
          });
        });

        return connection;
      });
    });
  }
  else if (mysql && mysql.Client) {
    // congratulations, you have node-mysql 0.9
    shimmer.wrapMethod(mysql && mysql.Client && mysql.Client.prototype,
                       'mysql.Client.prototype',
                       'query',
                       function (query) {
      return agent.tracer.segmentProxy(function () {
        logger.trace("Potentially tracing node-mysql 0.9 query.");
        var state = agent.getState();
        if (!state || arguments.length < 1) return query.apply(this, arguments);
        logger.trace("Tracing node-mysql 0.9 query on transaction %d.", state.getTransaction().id);

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

        // FIXME: need to grab error events as well, as they're also emitted on
        // the client

        var queried = query.apply(this, args);
        queried.once('end', function () {
          segment.end();
          logger.trace("node-mysql 0.9 query finished for transaction %d.", state.getTransaction().id);
        });

        return queried;
      });
    });
  }
};
