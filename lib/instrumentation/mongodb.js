"use strict";

var path     = require('path')
  , util     = require('util')
  , database = require(path.join(__dirname, '..', 'database'))
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  ;

module.exports = function initialize(agent, trace, mongodb) {
  function addFunctionProxy(name) {
    var operation = name;
    var statement = new database.ParsedStatement(operation, 'mongodb');

    shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype',
                       name, function (original) {
      return function () {
        var tracer = trace.createTracer(agent, statement.recordMetrics);
        if (tracer.dummy) return original.apply(this, arguments);

        var index = arguments.length - 1;
        if (index < 0 || typeof(arguments[index] !== 'function')) {
          try {
            return original.apply(this, arguments);
          }
          finally {
            tracer.finish();
          }
        }
        else {
          var args = Array.prototype.slice.call(arguments);

          // Proxy the callback so we know when the call has ended.
          var callback = args[index];

          var replacement = function () {
            tracer.finish();
            if (callback) return callback.apply(this,arguments);
          };

          args[index] = replacement;

          // call the original function.
          original.apply(this, args);
        }
      };
    });
  }

  // Proxy the CRUD functions.
  ['insert', 'find', 'update', 'remove', 'save'].forEach(function (name) {
    addFunctionProxy(name);
  });
};
