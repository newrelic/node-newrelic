/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')

/**
 *
 * @param root0
 * @param root0.check
 * @param root0.metrics
 * @param root0.expected
 */
function checkMetrics({ check = assert, metrics, expected }) {
  Object.keys(expected).forEach(function (name) {
    check.ok(metrics[name], 'should have metric ' + name)
    if (metrics[name]) {
      check.equal(
        metrics[name].callCount,
        expected[name],
        'should have ' + expected[name] + ' calls for ' + name
      )
    }
  })
}

module.exports = {
  checkMetrics
}
