'use strict';

var path     = require('path')
  , logger   = require(path.join(__dirname, '..', 'logger')).child({component : 'mysql'})
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  , MYSQL    = require(path.join(__dirname, '..', 'metrics', 'names')).MYSQL
  ;

module.exports = function initialize(agent, mysql) {
  var tracer = agent.tracer;

  // FIXME: need a more general way of differentiating between driver versions
  if (mysql && mysql.createConnection) {
    // congratulations, you have node-mysql 2.0
    shimmer.wrapMethod(mysql, 'mysql', 'createConnection', function (createConnection) {
      return tracer.segmentProxy(function () {
        var connection = createConnection.apply(this, arguments);

        shimmer.wrapMethod(connection, 'connection', 'query', function (query) {
          return tracer.callbackProxy(function (sql, values, callback) {
            logger.trace("Potentially tracing node-mysql 2 query.");
            var state = tracer.getState();
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

            var ps = parseSql(MYSQL.PREFIX, actualSql);
            var wrapped = tracer.callbackProxy(actualCallback);

            var current = state.getSegment();
            var segment = current.add(MYSQL.STATEMENT + ps.model + '/' + ps.operation,
                                      ps.recordMetrics.bind(ps));

            // capture connection info for datastore instance metric
            if (this.config) {
              segment.port = this.config.port;
              segment.host = this.config.host;
            }

            logger.trace("Adding node-mysql 2 query trace segment on transaction %d.",
                         state.getTransaction().id);
            state.setSegment(segment);

            var returned = query.call(this, sql, values, wrapped);
            returned.once('end', function () {
              segment.end();
              logger.trace("node-mysql 2 query finished for transaction %d.",
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
      return tracer.segmentProxy(function () {
        logger.trace("Potentially tracing node-mysql 0.9 query.");
        var state = tracer.getState();
        if (!state || arguments.length < 1) return query.apply(this, arguments);
        logger.trace("Tracing node-mysql 0.9 query on transaction %d.",
                     state.getTransaction().id);

        var args = tracer.slice(arguments);
        var ps = parseSql(MYSQL.PREFIX, args[0]);

        var current = state.getSegment();
        var segment = current.add(MYSQL.STATEMENT + ps.model + '/' + ps.operation,
                                  ps.recordMetrics.bind(ps));

        // capture connection info for datastore instance metric
        segment.port = this.port;
        segment.host = this.host;

        state.setSegment(segment);

        // find and wrap the callback
        if (args.length > 1 && typeof(args[args.length - 1]) === 'function') {
          args[args.length - 1] = tracer.callbackProxy(args[args.length - 1]);
        }

        // FIXME: need to grab error events as well, as they're also emitted on
        // the client

        var queried = query.apply(this, args);
        queried.once('end', function () {
          segment.end();
          logger.trace("node-mysql 0.9 query finished for transaction %d.",
                       state.getTransaction().id);
        });

        return queried;
      });
    });
  }
};
