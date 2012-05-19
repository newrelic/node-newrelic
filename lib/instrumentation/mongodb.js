var path     = require('path')
  , util     = require('util')
  , database = require(path.join(__dirname, '..', 'database'))
  , logger   = require(path.join(__dirname, '..', 'logger'))
  , shimmer  = require(path.join(__dirname, '..', 'shimmer'))
  ;

exports.initialize = function (agent, trace, mongodb) {
  function addFunctionProxy(name) {
    var operation = name;
    var statement = new database.ParsedStatement(operation, 'mongodb');

    var original = shimmer.preserveMethod(mongodb.Collection.prototype, name);
    mongodb.Collection.prototype[name] = function () {
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
        if (!callback) logger.debug("callback not found for " + operation + " at " + (new Error()).stack);

        var replacement = function () {
          tracer.finish();
          logger.debug("callback is " + util.inspect(callback));
          if (callback) return callback.apply(this,arguments);
        };

        args[index] = replacement;

        // call the original function.
        original.apply(this, args);
      }
    };
  }

  // Proxy the CRUD functions.
  ['insert','find','update','remove','save'].forEach(function (name) {
    addFunctionProxy(name);
  });
};
