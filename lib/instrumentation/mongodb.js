"use strict";

var path            = require('path')
  , util            = require('util')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  ;

module.exports = function initialize(agent, mongodb) {
  function addFunctionProxy(name) {
    var statement = new ParsedStatement(name, 'mongodb');

    shimmer.wrapMethod(mongodb.Collection.prototype,
                       'mongodb.Collection.prototype',
                       name,
                       function (original) {
      return function () {
        var state = agent.getState();
        if (!state) return original.apply(this, arguments);

        var segment = state.getSegment().add('Mongodb/' + name, statement.recordMetrics);

        var index = arguments.length - 1;
        if (index < 0 || typeof(arguments[index] !== 'function')) {
          try {
            return original.apply(this, arguments);
          }
          finally {
            segment.end();
          }
        }
        else {
          var args = Array.prototype.slice.call(arguments);

          // Proxy the callback so we know when the call has ended.
          var callback = args[index];

          var replacement = agent.tracer.callbackProxy(function () {
            segment.end();
            if (callback) return callback.apply(this, arguments);
          });

          args[index] = replacement;

          // call the original function.
          original.apply(this, args);
        }
      };
    });
  }

  // Proxy the CRUD functions.
  [
    'insert',
    'find',
    'findOne',
    'update',
    'remove',
    'save'
  ].forEach(function (name) {
    addFunctionProxy(name);
  });
};
