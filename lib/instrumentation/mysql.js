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
            if (!tracer.getTransaction() || arguments.length < 1) {
              return query.apply(this, arguments);
            }
            var transaction = tracer.getTransaction();

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

            var ps      = parseSql(MYSQL.PREFIX, actualSql)
              , wrapped = tracer.callbackProxy(actualCallback)
              , name    = MYSQL.STATEMENT + ps.model + '/' + ps.operation
              , segment = tracer.addSegment(name, ps.recordMetrics.bind(ps))
              ;

            // capture connection info for datastore instance metric
            if (this.config) {
              segment.port = this.config.port;
              segment.host = this.config.host;
            }

            logger.trace("Adding node-mysql 2 query trace segment on transaction %d.",
                         transaction.id);

            var returned = query.call(this, sql, values, wrapped);
            returned.once('end', function () {
              segment.end();
              logger.trace("node-mysql 2 query finished for transaction %d.",
                           transaction.id);
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
        if (!tracer.getTransaction() || arguments.length < 1) {
          return query.apply(this, arguments);
        }
        var transaction = tracer.getTransaction();
        logger.trace("Tracing node-mysql 0.9 query on transaction %d.",
                     transaction.id);

        var args    = tracer.slice(arguments)
          , ps      = parseSql(MYSQL.PREFIX, args[0])
          , name    = MYSQL.STATEMENT + ps.model + '/' + ps.operation
          , segment = tracer.addSegment(name, ps.recordMetrics.bind(ps))
          ;

        // capture connection info for datastore instance metric
        segment.port = this.port;
        segment.host = this.host;

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
                       transaction.id);
        });

        return queried;
      });
    });
  }
};
