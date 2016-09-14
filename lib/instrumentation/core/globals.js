'use strict'

var events = require('events')
var wrap = require('../../shimmer').wrapMethod
var promInit = require('../promise')

module.exports = initialize

/**
 * The spec for the native `Promise` class.
 */
var STATIC_PROMISE_METHODS = ['accept', 'all', 'defer', 'race', 'reject', 'resolve']
var NATIVE_PROMISE_SPEC = {
  name: 'global',
  constructor: 'Promise',
  executor: true,
  $proto: {
    then: ['then', 'chain'],
    catch: ['catch']
  },
  $static: {
    $copy: STATIC_PROMISE_METHODS,
    cast: STATIC_PROMISE_METHODS
  }
}

function initialize(agent) {
  // Add handler for uncaught/fatal exceptions to record them.
  // _fatalException is an undocumented feature of domains, introduced in
  // Node.js v0.8. We use _fatalException when possible because wrapping it will
  // not potentially change the behavior of the server.
  if (process._fatalException) {
    wrap(process, 'process', '_fatalException', function wrapper(original) {
      return function wrappedFatalException(error) {
        // Only record the error if we are not currently within an instrumented
        // domain.
        if (!process.domain) {
          agent.errors.add(null, error)
          agent.tracer.segment = null
        }
        return original.apply(this, arguments)
      }
    })
  } else {
    wrap(
      process,
      'process',
      'emit',
      function wrapEmit(original) {
        return function wrappedEmit(ev, error) {
          if (ev === 'uncaughtException' && error && !process.domain) {
            agent.errors.add(null, error)
            agent.tracer.segment = null
          }

          return original.apply(this, arguments)
        }
      }
    )
  }

  // Add a handler for unhandled promise rejections.
  process.on('unhandledRejection', function __NR_unhandledRejectionHandler(err, promise) {
    // If we're the only listener for this event, report the error.
    if (listenerCount(process, 'unhandledRejection') < 2) {
      var transaction = promise.__NR_segment && promise.__NR_segment.transaction
      agent.errors.add(transaction, err)
    }
  })

  promInit(agent, global, NATIVE_PROMISE_SPEC)
}

function listenerCount(emitter, evnt) {
  if (events.EventEmitter.listenerCount) {
    return events.EventEmitter.listenerCount(emitter, evnt)
  }
  return emitter.listeners(evnt).length
}
