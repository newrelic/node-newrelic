/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: remove this file once the test-utils repo has been updated and use helper.getShim() instead!
module.exports = function getShim(nodule) {
  const [shimSymbol] = Object.getOwnPropertySymbols(nodule).filter(
    (key) => key.toString() === 'Symbol(shim)'
  )
  return nodule[shimSymbol]
}
