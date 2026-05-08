/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const fs = require('fs')
const sinon = require('sinon')

const Test = require('../../versioned-runner/test')

const MOCK_TEST_DIR = path.resolve(__dirname, 'mock-tests')
const pkgVersions = {
  bluebird: { versions: ['1.0.8', '1.1.1', '1.2.4', '2.0.7'], latest: '2.0.7' },
  redis: { versions: ['1.0.0', '2.0.1', '2.1.0'], latest: '2.1.0' }
}

const ESM_MOCK_DIR = path.resolve(__dirname, 'mock-esm-tests')

test('Test construction', function (t) {
  let test = null
  assert.doesNotThrow(function () {
    test = new Test(MOCK_TEST_DIR, pkgVersions)
  }, 'should not throw when constructed')

  assert.ok(test instanceof Test, 'should construct a Test instance')
  assert.equal(test.type, 'commonjs', 'should default type to commonjs')
})

test('ESM Tests', async (t) => {
  const cp = require('child_process')
  const esmVersions = {
    redis: { versions: ['1.0.0'] }
  }

  t.beforeEach(() => {
    sinon.spy(cp, 'spawn')
  })

  t.afterEach(() => {
    cp.spawn.restore()
  })

  await t.test('should properly construct test with type of module', (t) => {
    let test = null
    assert.doesNotThrow(function () {
      test = new Test(ESM_MOCK_DIR, esmVersions)
    }, 'should not throw when constructed')

    assert.ok(test instanceof Test, 'should construct a Test instance')
    assert.equal(test.type, 'module', 'should default type to module')
  })

  await t.test('should not set loader when NR_LOADER is not specified', (t, end) => {
    const test = new Test(ESM_MOCK_DIR, esmVersions)
    const testRun = test.run()
    const { env } = cp.spawn.args[0][2]
    assert.ok(!env.NR_LOADER)
    // must force the mocked test run to complete so tap can shut down
    testRun.continue()
    testRun.once('completed', function () {
      testRun.continue()
      end()
    })
  })

  await t.test('should use NR_LOADER when specified', (t, end) => {
    const test = new Test(ESM_MOCK_DIR, esmVersions)
    process.env.NR_LOADER = 'bogus-loader.mjs'
    const testRun = test.run()
    const { env } = cp.spawn.args[0][2]
    assert.equal(
      env.NR_LOADER,
      `${process.cwd()}/bogus-loader.mjs`,
      'should use NR_LOADER but resolves path'
    )
    // must force the mocked test run to complete so tap can shut down
    testRun.continue()
    testRun.once('completed', function () {
      testRun.continue()
      end()
    })
  })
})

test('Test methods and members', async function (t) {
  t.beforeEach(function (ctx) {
    const test = new Test(MOCK_TEST_DIR, pkgVersions)
    ctx.nr = { test }
  })

  await t.test('Test#peek', function (t) {
    const { test } = t.nr
    const peek = test.peek()
    assert.deepEqual(
      peek,
      {
        packages: { redis: '1.0.0' },
        test: MOCK_TEST_DIR + '/redis.mock.fake-test.js'
      },
      'should return the next test to execute'
    )

    assert.deepEqual(peek, test.peek(), 'should not change the state of the test')
    assert.deepEqual(peek, test.peek(), 'should never change the state of the test')
  })

  await t.test('Test#next', function (t) {
    const { test } = t.nr
    let next = test.next()

    assert.deepEqual(
      next,
      {
        packages: { redis: '1.0.0' },
        test: MOCK_TEST_DIR + '/redis.mock.fake-test.js'
      },
      'should return the next test to execute'
    )

    next = test.next()
    assert.deepEqual(
      next,
      {
        packages: { redis: '1.0.0' },
        test: MOCK_TEST_DIR + '/other.mock.fake-test.js'
      },
      'should advance the state of the test'
    )

    next = test.next()
    assert.deepEqual(
      next,
      {
        packages: { redis: '2.0.1' },
        test: MOCK_TEST_DIR + '/redis.mock.fake-test.js'
      },
      'should advance the package versions when out of test files'
    )

    // Advance the test to the end.
    test.next()
    test.next()
    test.next()

    assert.doesNotThrow(function () {
      assert.equal(test.next(), null, 'should return null when no more tests available')
      assert.equal(test.next(), null, 'should keep returning null')
    }, 'should not error when reaching the end of the test')
  })

  await t.test('Test#run', function (t, end) {
    const { test } = t.nr
    t.plan(22)

    const peek = test.peek()
    const testRun = test.run()
    const nextPeek = test.peek()
    t.assert.ok(peek !== nextPeek, 'should advance the state of the test')

    const eventCounts = {}

    testRun.on('installing', incrementEvent('installing'))
    testRun.on('completed', incrementEvent('completed'))
    testRun.on('running', incrementEvent('running'))
    testRun.on('done', incrementEvent('done'))
    testRun.on('end', incrementEvent('end'))
    testRun.on('error', incrementEvent('error'))

    testRun.continue()
    testRun.once('completed', function () {
      t.assert.equal(eventCounts.completed, 1, 'should have completed only one step')
      t.assert.equal(eventCounts.installing, 1, 'should have completed installation')
      t.assert.equal(eventCounts.running, 0, 'should not have completed running')

      testRun.continue()
      testRun.once('completed', function () {
        t.assert.equal(eventCounts.completed, 2, 'should have completed only one step')
        t.assert.equal(eventCounts.installing, 1, 'should have completed installation')
        t.assert.equal(eventCounts.running, 1, 'should have completed running')
      })
    })

    testRun.on('end', function () {
      t.assert.deepEqual(
        eventCounts,
        {
          installing: 1,
          completed: 2,
          running: 1,
          done: 1,
          error: 0,
          end: 1
        },
        'should have emitted expected events'
      )

      t.assert.equal(testRun.failed, false, 'should not be marked as failed')

      t.assert.match(
        testRun.stdout,
        new RegExp(
          [
            // npm 7 + if running tests on fresh checkout
            '(?:\nadded \\d+ packages? in \\d(?:\\.\\d+)?s)?\n?',
            // npm 7 + when running tests that already have tests/unit/versioned/mock-tests/node_modules
            '(?:\nup to date in \\d(?:\\.\\d+)?s)?\n?',
            // stdout from loading the fake module
            '\nstdout - redis\\.mock\\.fake-test\\.js\n'
          ].join('')
        ),
        'should have expected stdout'
      )

      t.assert.equal(testRun.stderr, 'stderr - redis.mock.fake-test.js\n', 'should have expected stderr')

      nextTest()
    })

    function incrementEvent(evnt) {
      eventCounts[evnt] = 0
      return function () {
        ++eventCounts[evnt]
      }
    }

    function nextTest() {
      const nextRun = test.run()
      t.assert.ok(nextRun !== testRun, 'should return a new test run')

      nextRun.on('installing', incrementEvent('installing'))
      nextRun.on('completed', incrementEvent('completed'))
      nextRun.on('running', incrementEvent('running'))
      nextRun.on('done', incrementEvent('done'))
      nextRun.on('end', incrementEvent('end'))
      nextRun.on('error', incrementEvent('error'))

      nextRun.continue()
      nextRun.once('completed', function () {
        t.assert.equal(eventCounts.completed, 1, 'should have completed only one step')
        t.assert.equal(eventCounts.installing, 1, 'should have completed installation')
        t.assert.equal(eventCounts.running, 0, 'should not have completed running')

        nextRun.continue()
        nextRun.once('completed', function () {
          t.assert.equal(eventCounts.completed, 2, 'should have completed only one step')
          t.assert.equal(eventCounts.installing, 1, 'should have completed installation')
          t.assert.equal(eventCounts.running, 1, 'should have completed running')
        })
      })

      nextRun.on('end', function () {
        t.assert.deepEqual(
          eventCounts,
          {
            installing: 1,
            completed: 2,
            running: 1,
            done: 1,
            error: 0,
            end: 1
          },
          'should have emitted expected events'
        )

        t.assert.ok(nextRun.failed, 'should be marked as a failed run')
        t.assert.match(
          nextRun.stdout,
          new RegExp(
            [
              // npm 7 + when running tests that already have tests/unit/versioned/mock-tests/node_modules
              '(?:\nup to date in \\d(?:\\.\\d+)?s)?\n?',
              // stdout from loading the fake module
              '\nstdout - other\\.mock\\.fake-test\\.js\n'
            ].join('')
          ),
          'should have expected stdout'
        )

        t.assert.match(
          nextRun.stderr,
          new RegExp(
            [
              'stderr - other\\.mock\\.fake-test\\.js',
              'Failed to execute test: Error: Failed to execute node'
            ].join('\n')
          ),
          'should have expected stderr'
        )
        end()
      })
    }
  })
})

test('Will not filter tests when keywords are an empty list', function (t) {
  const test = new Test(MOCK_TEST_DIR, pkgVersions, {
    testPatterns: []
  })

  assert.equal(test.matrix._matrix[1].tests.files.length, 2, 'should include both test files')
})

test('should filter based on multiple keywords', function (t) {
  const test = new Test(MOCK_TEST_DIR, pkgVersions, {
    testPatterns: ['other.mock.fake-test.js', 'redis']
  })

  assert.equal(test.matrix._matrix[1].tests.files.length, 2, 'should include both test files')
})

test('Can filter tests by keyword', function (t) {
  const test = new Test(MOCK_TEST_DIR, pkgVersions, {
    testPatterns: ['redis']
  })

  assert.equal(test.matrix._matrix[1].tests.files.length, 1, 'should include only one test file')
  assert.equal(
    test.matrix._matrix[1].tests.files[0],
    'redis.mock.fake-test.js',
    'should only include the redis test file'
  )
})

test('should filter tests completely out when 0 matches based on patterns', function (t) {
  const test = new Test(MOCK_TEST_DIR, pkgVersions, {
    testPatterns: ['no-match']
  })

  assert.equal(test.matrix._matrix.length, 0, 'should completely filter out matrix')
})

test('check for unspecified test files', function (t) {
  const testFile = path.join(MOCK_TEST_DIR, 'ignoreme.mock.test.js')
  fs.writeFileSync(testFile, 'hello world')

  t.after(() => {
    fs.unlinkSync(testFile)
  })

  const test = new Test(MOCK_TEST_DIR, pkgVersions)
  assert.equal(test.missingFiles.length, 1)
})
