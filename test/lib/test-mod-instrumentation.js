/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// NOTE: This signature is different that traditional instrumentation as
// I am not passing in the agent, shim, etc like it is done in shimmer
// See: https://github.com/newrelic/node-newrelic/blob/main/lib/shimmer.js#L564
module.exports = function initialize(shim, testMod) {
  shim.wrap(testMod.default, 'testMethod', function wrapTestMethod(shim, orig) {
    return function wrappedTestMethod() {
      const result = orig.apply(this, arguments)
      return `${result} that we have instrumented.`
    }
  })

  shim.wrap(testMod, 'namedMethod', function wrapNamedMethod(shim, orig) {
    return function wrappedNamedMethod() {
      const result = orig.apply(this, arguments)
      return `${result} that we have instrumented.`
    }
  })
}
