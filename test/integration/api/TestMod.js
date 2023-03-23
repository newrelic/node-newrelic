/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
function TestMod() {}
TestMod.prototype.foo = function foo(bar) {
  return `value of ${bar}`
}
module.exports = TestMod
