/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// This file provides a custom test reporter for the native test runner
// included in Node.js >=18. The default `spec` reporter writes too much
// information to be usable in CI, and the `dot` reporter hides which tests
// failed. This custom reporter outputs nothing for successful tests, and
// outputs the failing test file when any failing test has occurred.
//
// See https://nodejs.org/api/test.html#custom-reporters.

const OUTPUT_MODE = process.env.OUTPUT_MODE?.toLowerCase() ?? 'simple'
const isSilent = OUTPUT_MODE === 'quiet' || OUTPUT_MODE === 'silent'

async function* reporter(source) {
  const passed = new Set()
  const failed = new Set()

  for await (const event of source) {
    // Once v18 has been dropped, we might want to revisit the output of
    // cases. The `event` object is supposed to provide things like
    // the failing line number and column, along with the failing test name.
    // But on v18, we seem to only get `1` for both line and column, and the
    // test name gets set to the `file`. So there isn't really any point in
    // trying to provide more useful reports here while we need to support v18.
    //
    // The issue may also stem from the current test suites still being based
    // on `tap`. Once we are able to migrate the actual test code to `node:test`
    // we should revisit this reporter to determine if we can improve it.
    //
    // See https://nodejs.org/api/test.html#event-testfail.
    switch (event.type) {
      case 'test:pass': {
        passed.add(event.data.file)
        if (isSilent === true) {
          yield ''
        } else {
          yield `passed: ${event.data.file}\n`
        }

        break
      }

      case 'test:fail': {
        failed.add(event.data.file)
        yield `failed: ${event.data.file}\n`
        break
      }

      default: {
        yield ''
      }
    }
  }

  if (failed.size > 0) {
    yield `\n\nFailed tests:\n`
    for (const file of failed) {
      yield `${file}\n`
    }
  }
  yield `\n\nPassed: ${passed.size}\nFailed: ${failed.size}\nTotal: ${passed.size + failed.size}\n`
}

export default reporter
