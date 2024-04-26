/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export default function initialize(shim, parseJson) {
  shim.wrap(parseJson, 'default', function wrappedParseJsonLib(_shim, orig) {
    return function wrappedParseJsonFunc() {
      const result = orig.apply(this, arguments)
      result.isInstrumented = true
      return result
    }
  })

  shim.wrapReturn(parseJson, 'JSONError', function jsonErrorWrap(shim, JSONError, name, instance) {
    instance.isInstrumented = true
    return instance
  })
}
