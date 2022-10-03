/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use-strict'

// import util from 'util'

export default function initialize(shim, parseJson) {
  shim.wrap(parseJson, 'default', function wrappedParseJsonLib(_shim, orig) {
    return function wrappedParseJsonFunc() {
      const result = orig.apply(this, arguments)
      result.isInstrumented = true
      return result
    }
  })

  shim.wrap(parseJson, 'JSONError', function wrappedParseJsonLib(_shim, orig) {
    // const WrappedError = function wrappedError() {
    //   console.log('hi')
    //   orig.apply(this, arguments)
    // }

    // util.inherits(WrappedError, orig)

    // return WrappedError

    class WrappedError extends orig {
      constructor(...args) {
        super(...args)

        this.isInstrumented = true
      }
    }

    return WrappedError
  })
}
