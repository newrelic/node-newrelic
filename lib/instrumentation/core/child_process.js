'use strict'

var wrap = require('../../shimmer').wrapMethod
var isWrapped = require('../../shimmer').isWrapped

module.exports = initialize

function initialize(agent, childProcess, moduleName, shim) {
  const methods = ['exec', 'execFile']

  shim.record(
    childProcess,
    methods,
    function recordExec(shim, fn, name) {
      return {name: 'child_process.' + name, callback: shim.LAST}
    }
  )

  const originalExec = shim.getOriginal(childProcess.exec)
  Object.getOwnPropertySymbols(originalExec).forEach((symbol) => {
    childProcess.exec[symbol] = originalExec[symbol]
  })

  const originalExecFile = shim.getOriginal(childProcess.execFile)
  Object.getOwnPropertySymbols(originalExecFile).forEach((symbol) => {
    childProcess.execFile[symbol] = originalExecFile[symbol]
  })

  var childProcessProto = childProcess && childProcess.ChildProcess
  // ChildProcess is exposed on Node 4 and higher
  if (childProcessProto) {
    wrapChildProcessCls(childProcess.ChildProcess)
  } else {
    wrap(childProcess, 'childProcess', ['fork', 'spawn'], wrapSpawn)
  }

  function  wrapSpawn(fn) {
    return function wrapped() {
      var child = fn.apply(this, arguments)
      if (child && child.constructor && child.constructor.prototype) {
        wrapChildProcessCls(child.constructor)
      }
      return child
    }
  }

  function wrapChildProcessCls(childProcessCls) {
    if (!childProcessCls || !childProcessCls.prototype ||
      isWrapped(childProcessCls.prototype.on)) {
      return
    }

    wrap(
      childProcessCls.prototype,
      'childProcess.ChildProcess.prototype',
      'on',
      function wrapEmit(fn) {
        return agent.tracer.wrapFunctionNoSegment(fn, ['on', 'addListener'])
      }
    )
  }
}
