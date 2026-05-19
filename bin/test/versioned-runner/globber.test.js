/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const globber = require('../../versioned-runner/globber')

const TEST_DIR = path.join(__dirname, 'mock-tests')

test('buildGlobs', async (t) => {
  await t.test('expand directory', (t) => {
    const globs = globber.buildGlobs([TEST_DIR])
    assert.equal(globs.length, 2)
    assert.deepEqual(globs, [`${TEST_DIR}/package.json`, `${TEST_DIR}/**/package.json`])
  })

  await t.test('glob pattern', (t) => {
    const globs = globber.buildGlobs([`${TEST_DIR}/*.js`])
    assert.equal(globs.length, 1)
    assert.deepEqual(globs, [`${TEST_DIR}/*.js`])
  })

  await t.test('handle single quotes', (t) => {
    const globs = globber.buildGlobs([`'${TEST_DIR}/*.js'`])
    assert.equal(globs.length, 1)
    assert.deepEqual(globs, [`${TEST_DIR}/*.js`])
  })

  await t.test('handle double quotes', (t) => {
    const globs = globber.buildGlobs([`"${TEST_DIR}/*.js"`])
    assert.equal(globs.length, 1)
    assert.deepEqual(globs, [`${TEST_DIR}/*.js`])
  })

  await t.test('specific file', (t) => {
    const globs = globber.buildGlobs([`${TEST_DIR}/other.mock.fake-test.js`])
    assert.equal(globs.length, 1)
    assert.deepEqual(globs, [`${TEST_DIR}/other.mock.fake-test.js`])
  })
})

test('resolveGlobs', async (t) => {
  await t.test('resolve asterisk', async (t) => {
    const files = await globber.resolveGlobs([`${TEST_DIR}/*.js`])
    assert.equal(files.length, 2)
    assert.deepEqual(files, [`${TEST_DIR}/redis.mock.fake-test.js`, `${TEST_DIR}/other.mock.fake-test.js`])
  })

  await t.test('filter out node modules', async (t) => {
    const files = await globber.resolveGlobs(
      [`${TEST_DIR}/scoped-pkgs/**/package.json`],
      [`${TEST_DIR}/package.json`]
    )
    assert.equal(files.length, 1)
    assert.deepEqual(files, [`${TEST_DIR}/scoped-pkgs/node_modules/@newrelic/package.json`])
  })

  await t.test('handle skips', async (t) => {
    const files = await globber.resolveGlobs(
      [`${TEST_DIR}/*.js`],
      [`${TEST_DIR}/redis.mock.fake-test.js`]
    )
    assert.equal(files.length, 1)
    assert.deepEqual(files, [`${TEST_DIR}/other.mock.fake-test.js`])
  })

  await t.test('handle duplicates', async (t) => {
    const files = await globber.resolveGlobs([`${TEST_DIR}/*.js`, `${TEST_DIR}/*.js`])
    assert.equal(files.length, 2)
    assert.deepEqual(files, [`${TEST_DIR}/redis.mock.fake-test.js`, `${TEST_DIR}/other.mock.fake-test.js`])
  })
})
