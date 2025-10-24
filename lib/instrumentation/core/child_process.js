/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { RecorderSpec } = require('../../../lib/shim/specs')

module.exports = initialize

function initialize(agent, childProcess, moduleName, shim) {
  if (!childProcess) {
    shim.logger.debug('Could not find child_process, not instrumenting')
    return false
  }

  const methods = ['exec', 'execFile']

  shim.record(childProcess, methods, function recordExec(shim, fn, name) {
    return new RecorderSpec({ name: 'child_process.' + name, callback: shim.LAST })
  })

  if (childProcess.ChildProcess) {
    wrapChildProcessClass(shim, childProcess.ChildProcess)
  } else {
    shim.logger.warn('childProcess.ChildProcess should be available in v2.2.0 or higher')
  }

  function wrapChildProcessClass(shim, childProcessClass) {
    shim.wrap(childProcessClass.prototype, 'on', function wrapChildProcessClassOn(shim, fn) {
      return function wrappedChildProcessOn(...args) {
        const cbIndex = args.length - 1

        const originalListener = args[cbIndex]
        if (!shim.isFunction(originalListener)) {
          return fn.apply(this, arguments)
        }

        shim.bindSegment(args, cbIndex)

        // Leverage events.removeListener() mechanism that checks listener
        // property to allow our wrapped listeners to match and remove appropriately.
        // Avoids having to instrument removeListener() and potentially doubling
        // lookup. Since our wrapping will only be referenced by the events
        // collection, we should not need to unwrap.
        args[cbIndex].listener = originalListener

        return fn.apply(this, args)
      }
    })
  }

  makePromisifyCompatible(shim, childProcess)
}

function makePromisifyCompatible(shim, childProcess) {
  const originalExec = shim.getOriginal(childProcess.exec)
  for (const symbol of Object.getOwnPropertySymbols(originalExec)) {
    childProcess.exec[symbol] = originalExec[symbol]
  }

  const originalExecFile = shim.getOriginal(childProcess.execFile)
  for (const symbol of Object.getOwnPropertySymbols(originalExecFile)) {
    childProcess.execFile[symbol] = originalExecFile[symbol]
  }
}
