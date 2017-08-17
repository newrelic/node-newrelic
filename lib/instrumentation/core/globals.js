'use strict'

var asyncHookInstrumentation = require('./async_hooks')
var events = require('events')
var wrap = require('../../shimmer').wrapMethod

module.exports = initialize


function initialize(agent) {
  // `_fatalException` is an undocumented feature of domains, introduced in
  // Node.js v0.8. We use `_fatalException` because wrapping it will not
  // potentially change the behavior of the server unlike listening for
  // `uncaughtException`.
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

  wrap(
    process,
    'process',
    'emit',
    function wrapEmit(original) {
      return function wrappedEmit(ev, error, promise) {
        // Check for unhandledRejections here so we don't change the
        // behavior of the event
        if (ev === 'unhandledRejection' && error && !process.domain) {
          if (listenerCount(process, 'unhandledRejection') === 0) {
          // If there are no unhandledRejection handlers report the error
            var transaction = promise.__NR_segment && promise.__NR_segment.transaction
            agent.errors.add(transaction, error)
          }
        }

        return original.apply(this, arguments)
      }
    }
  )

  // This will initialize the most optimal native-promise instrumentation
  // that we have available.
  asyncHookInstrumentation(agent)
}

function listenerCount(emitter, evnt) {
  if (events.EventEmitter.listenerCount) {
    return events.EventEmitter.listenerCount(emitter, evnt)
  }
  return emitter.listeners(evnt).length
}
