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
  enqueue(file, event) {
    if (this.has(file) === false) {
      this.set(file, {
        duration: 0,
        queued: new Set(),
        passed: 0,
        failed: 0,
        reported: false
      })
    }

    const tracked = this.get(file)
    tracked.queued.add(event.data.line)
  }

  dequeue(file, event) {
    const tracked = this.get(file)
    tracked.queued.delete(event.data.line)
  }

  fail(file, event) {
    const tracked = this.get(file)
    tracked.failed += 1
    tracked.duration += event.data.details?.duration_ms ?? 0
  }

  pass(file, event) {
    const tracked = this.get(file)
    tracked.passed += 1
    tracked.duration += event.data.details?.duration_ms ?? 0
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

// eslint-disable-next-line sonarjs/cognitive-complexity
async function * reporter(source) {
  const tracker = new Tracker()
  // The run-wide `test:summary` event provides the final counts. We cannot
  // derive the counts from the per-test events because, when test files are
  // run in isolated processes, the runner enqueues a wrapper test for each
  // file that never emits `test:pass`. Per-file summaries are not usable
  // either, as a file that crashes on load does not emit one.
  let counts

  for await (const event of source) {
    const file = event.data.file || event.data.name

    // Once v18 has been dropped, we might want to revisit the output of
    // cases. The `event` object is supposed to provide things like
    // the failing line number and column, along with the failing test name.
    // But on v18, we seem to only get `1` for both line and column, and the
    // test name gets set to the `file`. So there isn't really any point in
    // trying to provide more useful reports here while we need to support v18.
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
        const time = tracked.duration.toLocaleString('en-US', {
          style: 'unit',
          unit: 'millisecond',
          maximumSignificantDigits: 4
        })
        if (tracked.failed > 0) {
          yield `${colorize('fail', 'failed')}: ${file} (${time})\n`
          break
        }

        yield `${colorize('pass', 'passed')}: ${file} (${time})\n`
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

        const time = tracked.duration.toLocaleString('en-US', {
          style: 'unit',
          unit: 'millisecond',
          maximumSignificantDigits: 4
        })
        yield `${colorize('fail', 'failed')}: ${file} (${time})\n`
        break
      }

      case 'test:summary': {
        if (event.data.file === undefined) {
          counts = event.data.counts
        }
        yield ''
        break
      }

      default: {
        yield ''
      }
    }
  }

  const failures = tracker.failures
  if (failures.length > 0) {
    yield `\n\n${colorize('fail', 'Failed tests:')}\n`
    for (const file of failures) {
      yield `${file}\n`
    }
  }

  if (counts === undefined) {
    yield '\n\nNo run summary was received.\n'
    return
  }

  let summary = `\n\nPassed: ${counts.passed}\nFailed: ${counts.failed}\n`
  // Skipped, todo, and cancelled tests are counted in the total but not as
  // passed or failed, so they are listed to account for the difference.
  for (const [label, count] of [
    ['Skipped', counts.skipped],
    ['Todo', counts.todo],
    ['Cancelled', counts.cancelled]
  ]) {
    if (count > 0) {
      summary += `${label}: ${count}\n`
    }
  }
  summary += `Total: ${counts.tests}\n`
  yield summary
}

export default reporter
