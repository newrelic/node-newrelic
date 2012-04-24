var database = require('../database');

exports.initialize = function (agent, trace, mongodb) {
  function addFunctionProxy(name) {
    var operation = name;
    var statement = new database.ParsedStatement(operation, 'mongodb');

    var originalFunction = mongodb.Collection.prototype[name];
    mongodb.Collection.prototype[name] = function () {
      var tracer = trace.createTracer(agent, statement.recordMetrics);
      if (tracer.dummy) return originalFunction.apply(this, arguments);

      var callbackIndex = arguments.length-1;
      if (callbackIndex < 0) {
        try {
          return originalFunction.apply(this, arguments);
        }
        finally {
          tracer.finish();
        }
      }

      var args = Array.prototype.slice.call(arguments);

      // Proxy the callback so we know when the call has ended.
      var origCallback = args[callbackIndex];

      var newCallback = function () {
        tracer.finish();
        return origCallback.apply(this,arguments);
      };

      args[callbackIndex] = newCallback;

      // call the original function.
      originalFunction.apply(this, args);
    };
  }

  // Proxy the CRUD functions.
  ['insert','find','update','remove','save'].forEach(function (name) {
    addFunctionProxy(name);
  });
};
