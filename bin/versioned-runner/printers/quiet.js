/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const TestPrinter = require('./printer')

/**
 * A printer that will only write output to the destination stream when
 * an error has occurred in a test suite.
 */
class QuietPrinter extends TestPrinter {
  print() {
    // This method is required by TestPrinter.maybePrint, but we don't need
    // to do anything.
  }

  update(test, status) {
    // This method is used by the runner to update the status of a test.
    // We only care if the test has failed. If it has, then indicate that
    // the output should be printed.
    const failed = this._isFailure(status) === true
    this._doUpdate(test, status, failed === true)
  }
}

module.exports = QuietPrinter
