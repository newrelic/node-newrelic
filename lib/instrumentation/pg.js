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

  var constructors = [
    {english: 'pg.native', nodule: pgsql.native},
    {english: 'pg.native.pools', nodule: pgsql.native.pools}
    ];


    //wrapping for native
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
              , name = POSTGRES.OPERATION + 'query'
              , segment = tracer.addSegment(name, record)
              , position = arguments.length - 1
              , last = arguments[position]
              ;
            logger.trace("Adding postgres command trace segment transaction %d.",
              transaction.id);

            // capture connection info for datastore instance metric
            // segment.port = this.port;
            // segment.host = this.host;


            if (typeof last === 'function') {
              arguments[position] = tracer.callbackProxy(last);
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

        // capture connection info for datastore instance metric
        // segment.port = this.port;
        // segment.host = this.host;

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