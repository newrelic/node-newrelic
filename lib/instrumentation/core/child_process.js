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
