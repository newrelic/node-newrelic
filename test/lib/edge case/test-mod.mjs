/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const testMod = Object.create(null)
testMod.testMethod = function testMethod() {
  return 'this is a test method'
}

export default testMod
export const namedMethod = function namedMethod() {
  return 'this is a named method'
}
