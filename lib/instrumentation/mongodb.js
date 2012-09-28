"use strict";

var path            = require('path')
  , util            = require('util')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  ;

module.exports = function initialize(agent, mongodb) {
  function addFunctionProxy(name) {
    var statement = new ParsedStatement(name, 'mongodb');

    shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype', name, function (original) {
      return agent.tracer.segmentProxy(function () {
        var state = agent.getState();
        // bail out -- something's hosed
        if (!state || arguments.length < 1) return original.apply(this, arguments);

        var current = state.getSegment();
        var statementSegment = current.add('Mongodb/' + name, statement.recordMetrics);
        state.setSegment(statementSegment);

        var callback = arguments[arguments.length - 1];
        if (typeof(callback) !== 'function') {
          try {
            return original.apply(this, arguments);
          }
          // FIXME: this totally doesn't work; need to capture the Cursor
          // (which is a promise in disguise) and figure out how to time how long
          // it takes to return
          finally {
            statementSegment.end();
          }
        }
        else {
          var args = Array.prototype.slice.call(arguments);

          args[args.length - 1] = agent.tracer.callbackProxy(function () {
            statementSegment.end();

            return callback.apply(this, arguments);
          });

          // call the original function.
          return original.apply(this, args);
        }
      });
    });
  }

  // Proxy the CRUD functions.
  [
    'insert',
    'find',
    'update',
    'remove',
    'save'
  ].forEach(function (name) {
    addFunctionProxy(name);
  });
};
