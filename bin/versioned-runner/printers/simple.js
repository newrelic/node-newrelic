/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const readline = require('readline')
const util = require('util')

const TestPrinter = require('./printer')

function SimplePrinter(tests, opts) {
  TestPrinter.call(this, tests, opts)
  this._updatedTests = []
  this._hasPrinted = false
}
util.inherits(SimplePrinter, TestPrinter)

SimplePrinter.prototype.update = function update(test, status) {
  process.stdout.write('.')
  if (this._isFailure(status)) {
    this._clearLine()
  }
  const shouldPrint = status === 'done' || this._isFailure(status)
  const testName = this._doUpdate(test, status, shouldPrint)
  if (shouldPrint) {
    this._updatedTests.push(testName)
  }
}

SimplePrinter.prototype.print = function print() {
  this._clearLine()

  if (!this._hasPrinted) {
    console.log(TestPrinter.HR) // eslint-disable-line no-console
    this._hasPrinted = true
  }
  const updatedTests = this._updatedTests
  this._updatedTests = []
  updatedTests.forEach((testName) => {
    console.log(this._formatTest(testName)) // eslint-disable-line no-console
  })
}

SimplePrinter.prototype.end = function end() {
  TestPrinter.prototype.end.apply(this, arguments)
  console.log(TestPrinter.HR) // eslint-disable-line no-console
}

SimplePrinter.prototype._clearLine = function _clearLine() {
  if (process.stdout.isTTY) {
    readline.clearLine(process.stdout, 0)
    readline.cursorTo(process.stdout, 0)
  } else {
    process.stdout.write('\n')
  }
}

module.exports = SimplePrinter
