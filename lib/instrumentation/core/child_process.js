'use strict'

module.exports = initialize

function initialize(agent, childProcess, moduleName, shim) {
  if (!childProcess) {
    shim.log.debug('Could not find child_process, not instrumenting')
    return false
  }

  const methods = ['exec', 'execFile']

  shim.record(
    childProcess,
    methods,
    function recordExec(shim, fn, name) {
      return {name: 'child_process.' + name, callback: shim.LAST}
    }
  )

  if (childProcess.ChildProcess) {
    wrapChildProcessClass(shim, childProcess.ChildProcess)
  } else {
    shim.logger.warn('childProcess.ChildProcess should be available in v2.2.0 or higher')
  }

  function wrapChildProcessClass(shim, childProcessClass) {
    shim.wrap(
      childProcessClass.prototype,
      'on',
      function wrapChildProcessClassOn(shim, fn) {
        return function wrappedChildProcessOn() {
          const args = shim.argsToArray.apply(shim, arguments)
          const cbIndex = args.length - 1

          shim.bindSegment(args, cbIndex)

          return fn.apply(this, args)
        }
      }
    )

    shim.wrap(
      childProcessClass.prototype,
      'removeListener',
      function wrapChildProcessClassRemoveListener(shim, fn) {
        return function wrappedChildProcessRemoveListener() {
          const args = shim.argsToArray.apply(shim, arguments)
          const [type, listener] = args

          const eventOrEvents = this._events && this._events[type]
          if (!eventOrEvents) {
            // this is a little redundant but defering for safety.
            return fn.apply(this, arguments)
          }

          // Don't need to wrap listener.listener. That should only happen for once() case.
          // We only wrap the high-level, which once will pass here.
          if (eventOrEvents.__NR_original && eventOrEvents.__NR_original === listener) {
            args[1] = eventOrEvents
            const returnVal = fn.apply(this, args)
            eventOrEvents.__NR_unwrap()
            return returnVal
          } else if (!shim.isFunction(eventOrEvents)) {
            let nrListener = findMatchingListener(eventOrEvents, listener)
            if (nrListener) {
              args[1] = nrListener
              const returnVal = fn.apply(this, args)
              nrListener.__NR_unwrap()
              return returnVal
            }
          }

          return fn.apply(this, arguments)
        }
      }
    )
  }

  makePromisifyCompatible(shim, childProcess)
}

function findMatchingListener(events, listener) {
  // Walk backwards to find item
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.__NR_original && event.__NR_original === listener) {
      return event
    }
  }

  return null
}

function makePromisifyCompatible(shim, childProcess) {
  const originalExec = shim.getOriginal(childProcess.exec)
  Object.getOwnPropertySymbols(originalExec).forEach((symbol) => {
    childProcess.exec[symbol] = originalExec[symbol]
  })

  const originalExecFile = shim.getOriginal(childProcess.execFile)
  Object.getOwnPropertySymbols(originalExecFile).forEach((symbol) => {
    childProcess.execFile[symbol] = originalExecFile[symbol]
  })
}
