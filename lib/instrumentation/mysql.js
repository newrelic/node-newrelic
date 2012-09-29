'use strict';

var path     = require('path')
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  ;

module.exports = function initialize(agent, mysql) {
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
};
