/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const sinon = require('sinon')
const TestMatrix = require('../../../versioned-runner/matrix')
const TestPrinter = require('../../../versioned-runner/printers/printer')

const MOCK_TEST_DIR = path.resolve(__dirname, 'mock-tests')

test('Printer construction', function (t) {
  let printer = null
  assert.doesNotThrow(function () {
    printer = new TestPrinter(
      [`${MOCK_TEST_DIR}/bluebird/package.json`, `${MOCK_TEST_DIR}/redis/package.json`],
      { refresh: 100 }
    )
  }, 'should not throw when constructed')

  assert.ok(printer instanceof TestPrinter, 'should construct a TestPrinter instance')
  clearInterval(printer.interval)
})

/* eslint-disable no-console */
test('maybePrintMissing', async function (t) {
  t.beforeEach((ctx) => {
    sinon.stub(console, 'log')
    const printer = new TestPrinter(
      [`${MOCK_TEST_DIR}/bluebird/package.json`, `${MOCK_TEST_DIR}/redis/package.json`],
      { refresh: 100 }
    )
    ctx.nr = { printer }
  })

  t.afterEach((ctx) => {
    clearInterval(ctx.nr.printer.interval)
    console.log.restore()
  })

  await t.test('should print properly formatted missing tests', (t) => {
    const { printer } = t.nr
    printer.tests.bluebird.test = { missingFiles: ['file1', 'file2', 'file3'] }
    printer.tests.redis.test = { missingFiles: ['file3', 'file4', 'file5'] }
    printer.maybePrintMissing()
    const logArgs = console.log.args
    assert.match(logArgs[0][0], /The following test suites had test files that were not included in their package.json:\n/)
    assert.match(logArgs[1][0], /bluebird:\n\t- file1\n\t- file2\n\t- file3/)
    assert.match(logArgs[2][0], /redis:\n\t- file3\n\t- file4\n\t- file5/)
  })

  await t.test('should not print missing tests when none exst', (t) => {
    const { printer } = t.nr
    printer.tests.bluebird.test = {}
    printer.tests.redis.test = {}
    printer.maybePrintMissing()
    assert.deepEqual(console.log.args, [], 'should not have logged missing files when they do not exist')
  })
})

test('printVersionedMatrix', async function (t) {
  t.beforeEach((ctx) => {
    sinon.stub(console, 'log')
    const printer = new TestPrinter(
      [`${MOCK_TEST_DIR}/bluebird/package.json`, `${MOCK_TEST_DIR}/redis/package.json`],
      { refresh: 100 }
    )
    ctx.nr = { printer }
  })

  t.afterEach((ctx) => {
    clearInterval(ctx.nr.printer.interval)
    console.log.restore()
  })

  await t.test('should print versions by package', (t) => {
    const { printer } = t.nr
    const bluebirdMatrix = new TestMatrix(
      [
        {
          engines: { node: '<0.1.0' },
          dependencies: { bluebird: '*' },
          files: ['other.tap.js']
        },
        {
          dependencies: { bluebird: '>=1.0.0' },
          files: ['other.tap.js']
        }
      ],
      {
        bluebird: { versions: ['1.0.3', '1.3.4', '2.0.1', '3.8.1', '4.0.0'] }
      }
    )
    const redisMatrix = new TestMatrix(
      [
        {
          engines: { node: '<0.1.0' },
          dependencies: { redis: '*' },
          files: ['redis.tap.js', 'other.tap.js']
        },
        {
          dependencies: { redis: '>=1.0.0' },
          files: ['redis.tap.js', 'other.tap.js']
        }
      ],
      {
        redis: { versions: ['1.2.3', '1.3.4', '2.0.1'] }
      }
    )
    printer.tests.bluebird.test = { matrix: bluebirdMatrix }
    printer.tests.redis.test = { matrix: redisMatrix }
    printer.printVersionedMatrix()
    assert.deepEqual(console.log.args, [
      ['Versions executed\n'],
      ['Folder: bluebird'],
      ['\t * bluebird(5): 1.0.3, 1.3.4, 2.0.1, 3.8.1, 4.0.0'],
      ['Folder: redis'],
      ['\t * redis(3): 1.2.3, 1.3.4, 2.0.1'],
      ['===============================================================']
    ])
  })

  await t.test('should print skipped when no versions for a package exist', (t) => {
    const { printer } = t.nr
    const bluebirdMatrix = new TestMatrix(
      [
        {
          engines: { node: '<0.1.0' },
          dependencies: { bluebird: '1.0.0' },
          files: ['other.tap.js']
        }
      ],
      {
        bluebird: { versions: ['2.0.0'] }
      }
    )
    const redisMatrix = new TestMatrix(
      [
        {
          engines: { node: '<0.1.0' },
          dependencies: { redis: '*' },
          files: ['redis.tap.js', 'other.tap.js']
        },
        {
          dependencies: { redis: '>=1.0.0' },
          files: ['redis.tap.js', 'other.tap.js']
        }
      ],
      {
        redis: { versions: ['1.2.3', '1.3.4', '2.0.1'] }
      }
    )
    printer.tests.bluebird.test = { matrix: bluebirdMatrix }
    printer.tests.redis.test = { matrix: redisMatrix }
    printer.printVersionedMatrix()
    assert.deepEqual(console.log.args, [
      ['Versions executed\n'],
      ['Folder: bluebird(SKIPPED)'],
      ['Folder: redis'],
      ['\t * redis(3): 1.2.3, 1.3.4, 2.0.1'],
      ['===============================================================']
    ])
  })
})

/* eslint-enable no-console */
