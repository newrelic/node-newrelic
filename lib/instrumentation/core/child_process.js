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
  }

  makePromisifyCompatible(shim, childProcess)
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
