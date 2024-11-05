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

function colorize(type, text) {
  if (type === 'pass') {
    const blackText = `\x1b[30m${text}`
    const boldblackText = `\x1b[1m${blackText}`
    // Green background with black text
    return `\x1b[42m${boldblackText}\x1b[0m`
  }

  if (type === 'fail') {
    const whiteText = `\x1b[37m${text}`
    const boldWhiteText = `\x1b[1m${whiteText}`
    // Red background with white text
    return `\x1b[41m${boldWhiteText}\x1b[0m`
  }

  return text
}

async function* reporter(source) {
  const passed = new Set()
  const failed = new Set()

  // We'll use the queued map to deal with `enqueue` and `dequeue` events.
  // This lets us keep track of individual tests (each "test()" in a test file
  // counts as one test). We can probably refactor this out once we are set
  // Node >=20 as a baseline, because it has a `test:completed` event.
  const queued = new Map()

  // We only want to report for the overall test file having passed or failed.
  // Since we don't have Node >= 20 events available, we have to fudge it
  // ourselves.
  const reported = new Set()

  for await (const event of source) {
    const file = event.data.file

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
      case 'test:enqueue': {
        if (queued.has(file) === false) {
          queued.set(file, new Set())
        }
        const tests = queued.get(file)
        tests.add(event.data.line)
        break
      }

      case 'test:dequeue': {
        queued.get(file).delete(event.data.line)
        break
      }

      case 'test:pass': {
        passed.add(file)
        if (isSilent === true) {
          yield ''
          break
        }

        if (queued.get(file).size > 0 || reported.has(file) === true) {
          break
        }

        reported.add(file)
        yield `${colorize('pass', 'passed')}: ${file}\n`
        break
      }

      case 'test:fail': {
        if (queued.get(file).size > 0 || reported.has(file) === true) {
          break
        }

        reported.add(file)
        failed.add(file || event.data.name)
        yield `${colorize('fail', 'failed')}: ${file}\n`
        break
      }

      default: {
        yield ''
      }
    }
  }

  if (failed.size > 0) {
    yield `\n\n${colorize('fail', 'Failed tests:')}\n`
    for (const file of failed) {
      yield `${file}\n`
    }
  }

  yield `\n\nPassed: ${passed.size}\nFailed: ${failed.size}\nTotal: ${passed.size + failed.size}\n`
}

export default reporter
