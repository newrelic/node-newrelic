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

class Tracker extends Map {
  #total = 0
  #passed = 0
  #failed = 0

  isTracked(file) {
    return this.has(file)
  }

  enqueue(file, event) {
    if (this.has(file) === false) {
      this.set(file, {
        queued: new Set(),
        passed: 0,
        failed: 0,
        reported: false
      })
    }

    const tracked = this.get(file)
    tracked.queued.add(event.data.line)
    this.#total += 1
  }

  dequeue(file, event) {
    this.get(file).queued.delete(event.data.line)
  }

  fail(file) {
    const tracked = this.get(file)
    tracked.failed += 1
    this.#failed += 1
  }

  pass(file) {
    const tracked = this.get(file)
    tracked.passed += 1
    this.#passed += 1
  }

  get failedCount() {
    return this.#failed
  }

  get passedCount() {
    return this.#passed
  }

  get totalCount() {
    return this.#total
  }

  get failures() {
    const result = []
    for (const [file, tracked] of this.entries()) {
      if (tracked.failed > 0) {
        result.push(file)
      }
    }
    return result
  }
}

async function* reporter(source) {
  const tracker = new Tracker()

  for await (const event of source) {
    const file = event.data.file || event.data.name

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
        tracker.enqueue(file, event)
        break
      }

      case 'test:dequeue': {
        tracker.dequeue(file, event)
        break
      }

      case 'test:pass': {
        tracker.pass(file, event)

        const tracked = tracker.get(file)
        if (tracked.queued.size > 0 || tracked.reported === true) {
          break
        }

        if (isSilent === true) {
          yield ''
          break
        }

        tracked.reported = true

        // This event is fired for each subtest in a file. As an example,
        // if a file has three tests, the first a passing, the second a failing,
        // and the third a passing test, then we will hit `test:pass` for the
        // final passing test, but the suite overall has failed. So we need
        // report the failure here. At least until we get to Node.js 20 where
        // there is a finalized `test:complete` event.
        if (tracked.failed > 0) {
          yield `${colorize('fail', 'failed')}: ${file}\n`
          break
        }

        yield `${colorize('pass', 'passed')}: ${file}\n`
        break
      }

      case 'test:fail': {
        tracker.fail(file, event)

        const tracked = tracker.get(file)
        if (tracked.queued.size > 0 || tracked.reported === true) {
          break
        }

        if (isSilent === true) {
          yield ''
          break
        }

        tracked.reported = true

        yield `${colorize('fail', 'failed')}: ${file}\n`
        break
      }

      default: {
        yield ''
      }
    }
  }

  if (tracker.failedCount > 0) {
    yield `\n\n${colorize('fail', 'Failed tests:')}\n`
    for (const file of tracker.failures) {
      yield `${file}\n`
    }
  }

  yield `\n\nPassed: ${tracker.passedCount}\nFailed: ${tracker.failedCount}\nTotal: ${tracker.totalCount}\n`
}

export default reporter
