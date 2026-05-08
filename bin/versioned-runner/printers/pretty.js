/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logUpdate = require('log-update').default
const util = require('util')

const TestPrinter = require('./printer')

function PrettyPrinter(tests, opts) {
  TestPrinter.call(this, tests, opts)
}
util.inherits(PrettyPrinter, TestPrinter)

PrettyPrinter.prototype.update = function update(test, status) {
  if (this._isFailure(status)) {
    logUpdate.done() // Commit current output.
  }
  this._doUpdate(test, status, true)
}

PrettyPrinter.prototype.print = function print() {
  let out = TestPrinter.HR + '\n'
  out += Object.keys(this.tests).sort().map(this._formatTest.bind(this)).join('\n')
  out += '\n' + TestPrinter.HR
  logUpdate(out)
}

PrettyPrinter.prototype.end = function end() {
  TestPrinter.prototype.end.apply(this, arguments)
  logUpdate.done()
}

module.exports = PrettyPrinter
