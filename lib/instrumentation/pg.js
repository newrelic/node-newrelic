'use strict';

var path        = require('path')
  , shimmer     = require(path.join(__dirname, '..', 'shimmer'))
  , logger      = require(path.join(__dirname, '..', 'logger'))
                    .child({component : 'pg'})
  , record = require(path.join(__dirname, '..', 'metrics', 'recorders', 'pg.js'))
  , POSTGRES  = require(path.join(__dirname, '..', 'metrics', 'names')).POSTGRES
  ;

var INSTRUMENTED_OPERATIONS = [
  'query'
];

module.exports = function initialize(agent, pgsql) {
  if (!agent.config.feature_flag.postgres) return;
  var tracer = agent.tracer;

  INSTRUMENTED_OPERATIONS.forEach(function cb_forEach(operation) {
    shimmer.wrapMethod(pgsql && pgsql.Client && pgsql.Client.prototype,
      'pg.Client.prototype',
      operation,
      function wrapper(cmd) {
        return tracer.segmentProxy(function wrapped() {
          if (!tracer.getTransaction() || arguments.length < 1) {
            logger.trace("Not tracing postgres command due to no transaction state.");
            return cmd.apply(this, arguments);
          }
          var transaction = tracer.getTransaction()
            , args = tracer.slice(arguments)
            , name = POSTGRES.OPERATION + operation
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
  });
};