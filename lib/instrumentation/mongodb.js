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
        var trans = agent.getTransaction();
        if (!trans) return original.apply(this.arguments);

        var segment = agent.getTransaction().getTrace.add(null, statement.recordMetrics);

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

          var replacement = function () {
            segment.end();
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
