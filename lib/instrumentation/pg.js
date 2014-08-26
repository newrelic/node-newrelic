'use strict';

var path        = require('path')
  , shimmer     = require(path.join(__dirname, '..', 'shimmer'))
  , logger      = require(path.join(__dirname, '..', 'logger'))
                    .child({component : 'pg'})
  , record = require(path.join(__dirname, '..', 'metrics', 'recorders', 'pg.js'))
  , POSTGRES  = require(path.join(__dirname, '..', 'metrics', 'names')).POSTGRES
  ;

module.exports = function initialize(agent, pgsql) {

  //FLAG: postgres
  if (!agent.config.feature_flag.postgres) return;
  var tracer = agent.tracer;



  //allows for native wrapping to not happen if not neccessary

  //when env var is true
  if (process.env.NODE_PG_FORCE_NATIVE) {
    instrumentPGNative('pg', pgsql);
  }

  //using ('pg').native in their require
  else {
    var origGetter = pgsql.__lookupGetter__('native');
    delete pgsql.native;
    pgsql.__defineGetter__('native', function() {
      var temp = origGetter();
      instrumentPGNative('pg.native', pgsql.native);
      return temp;
    });
  }


  //wrapping for native
  function instrumentPGNative(eng, pg) {
    var constructors = [
        {english: eng, nodule: pg},
        {english: eng + '.pools', nodule: pg.pools}
      ];

    constructors.forEach(function cb_forEach(obj) {
      shimmer.wrapMethod(obj.nodule,
        obj.english,
        'Client',
        function wrapper(client) {
          return function wrapClient() {
            var connection = client.apply(this, arguments);

            shimmer.wrapMethod(connection, 'Connection', 'connect', function conn_wrapper(connect) {
              return function wrapConnect(callback) {
                if (typeof callback === 'function') {
                  callback =  tracer.callbackProxy(callback);
                }
                return connect.call(this, callback);
              }
            });

            shimmer.wrapMethod(connection, 'Connection', 'query', function query_wrapper(query) {
              return function wrapQuery() {

              if (!tracer.getTransaction() || arguments.length < 1) {
                logger.trace("Not tracing postgres command due to no transaction state.");
                return query.apply(this, arguments);
              }

              var transaction = tracer.getTransaction()
                , name        = POSTGRES.OPERATION + 'query'
                , segment     = tracer.addSegment(name, record)
                , pos         = arguments.length - 1
                , last        = arguments[pos]
                ;
              logger.trace("Adding postgres command trace segment transaction %d.",
                transaction.id);

              // capture connection info for datastore instance metric
              segment.host = connection.host;
              segment.port = connection.port;

              if (typeof last === 'function') {
                arguments[pos] = tracer.callbackProxy(function cb_pgquery() {
                  last.apply(this, arguments);
                  segment.end();
                  logger.trace("postgres command trace segment ended for transaction %d.",
                    transaction.id);
                });
              }
              else { // let's shove a callback in there for fun
                args.push(function cb_push() {
                  segment.end();
                  logger.trace("postgres command trace segment ended for transaction %d.",
                    transaction.id);
                });
              }
              return query.apply(this,arguments);
              }
            });
          return connection;
          }
        });
    });
  }



  //wrapping for JS
  shimmer.wrapMethod(pgsql && pgsql.Client && pgsql.Client.prototype,
    'pg.Client.prototype',
    'query',
    function wrapper(cmd) {
      return tracer.segmentProxy(function wrapped() {
        if (!tracer.getTransaction() || arguments.length < 1) {
          logger.trace("Not tracing postgres command due to no transaction state.");
          return cmd.apply(this, arguments);
        }
        var transaction = tracer.getTransaction()
          , args = tracer.slice(arguments)
          , name = POSTGRES.OPERATION + 'query'
          , segment = tracer.addSegment(name, record)
          , position = args.length - 1
          , last = args[position]
          ;

        logger.trace("Adding postgres command trace segment transaction %d.",
          transaction.id);

        //TODO: capture connection info for datastore instance metric
        //segment.host = connection.host;
        //segment.port = connection.port;

        function finalize(target) {
          return function cls_finalize() {
            var returned = target.apply(this, arguments);
            segment.end();
            logger.trace("postgres command trace segment ended for transaction %d.",
            transaction.id);

            return returned;
          };
        }

        if (typeof last === 'function') {
          args[position] = tracer.callbackProxy(finalize(last));
        }
        else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') {
          var callback = finalize(last[last.length - 1]);
          last[last.length - 1] = tracer.callbackProxy(callback);
        }
        else { // let's shove a callback in there for fun
          args.push(function cb_push() {
            segment.end();
            logger.trace("postgres command trace segment ended for transaction %d.",
              transaction.id);
          });
        }
        return cmd.apply(this, args);
      });
    });
}