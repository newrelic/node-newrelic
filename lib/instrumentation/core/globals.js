'use strict'

var asyncHookInstrumentation = require('./async_hooks')
var events = require('events')
var logger = require('../../logger').child({component: 'globals'})
var shimmer = require('../../shimmer')

module.exports = initialize


function initialize(agent) {
  // `_fatalException` is an undocumented feature of domains, introduced in
  // Node.js v0.8. We use `_fatalException` because wrapping it will not
  // potentially change the behavior of the server unlike listening for
  // `uncaughtException`.
  shimmer.wrapMethod(process, 'process', '_fatalException', function wrapper(original) {
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

  shimmer.wrapMethod(process, 'process', 'emit', wrapEmit)
  function wrapEmit(original) {
    return function wrappedEmit(ev, error, promise) {
      // Check for unhandledRejections here so we don't change the behavior of
      // the event.
      if (ev === 'unhandledRejection' && error && !process.domain) {
        if (listenerCount(process, 'unhandledRejection') === 0) {
          // If there are no unhandledRejection handlers report the error.
          var segment = promise.__NR_context && promise.__NR_context.getSegment()
          var tx = segment && segment.transaction
          logger.trace('Captured unhandled rejection for transaction %s', tx && tx.id)
          agent.errors.add(tx, error)
        }
      }

      return original.apply(this, arguments)
    }
  }

  // This will initialize the most optimal native-promise instrumentation that
  // we have available.
  asyncHookInstrumentation(agent)
}

function listenerCount(emitter, evnt) {
  // EventEmitter#listenerCount was introduced in Node 3.2.0. The older
  // EventEmitter.listenerCount was introduced in Node 0.9.12 and deprecated in
  // Node 4.0.0.
  // TODO: Simplify this logic when dropping Node <4.
  if (emitter.listenerCount) {
    return emitter.listenerCount(evnt)
  }
  return events.EventEmitter.listenerCount(emitter, evnt)
}
