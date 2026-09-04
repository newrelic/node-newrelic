/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ChildProcessExec = require('./exec')

module.exports = class ChildProcessExecFile extends ChildProcessExec {
  constructor({ agent, logger }) {
    super({ agent, logger, methodName: 'execFile' })
  }
}
