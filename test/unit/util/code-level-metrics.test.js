/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const getCLMMeta = require('../../../lib/util/code-level-metrics')
const { anon, arrow, named } = require('../../lib/clm-helper')
const path = require('path')
const helperPath = path.resolve(`${__dirname}/../../lib/clm-helper.js`)
const sinon = require('sinon')

/**
 * Helper to generate a long string
 *
 * @param {number} len length of string
 * @returns {string} string of proper length
 */
function longString(len) {
  // add 1 because arrays start at 0
  return Array(len + 1).join('a')
}

tap.test('CLM Meta', (t) => {
  t.autoend()

  t.test('should return function name as code.function from function reference', (t) => {
    function testFunction() {}
    const meta = getCLMMeta(testFunction)
    t.same(meta, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 30
    })
    t.end()
  })

  t.test('should return variable name as code.function from function reference', (t) => {
    const testFunction = function () {}
    const meta = getCLMMeta(testFunction)
    t.same(meta, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 41
    })
    t.end()
  })

  t.test(
    'should return function name not variable name as code.function from function reference',
    (t) => {
      const meta = getCLMMeta(named)
      t.same(meta, {
        'code.filepath': helperPath,
        'code.function': 'testFunction',
        'code.lineno': 11
      })
      t.end()
    }
  )

  t.test('should return (anonymous) as code.function from (anonymous) function reference', (t) => {
    const meta = getCLMMeta(anon)
    t.same(meta, {
      'code.filepath': helperPath,
      'code.function': '(anonymous)',
      'code.lineno': 9
    })
    t.end()
  })

  t.test('should return (anonymous) as code.function from arrow function reference', (t) => {
    const meta = getCLMMeta(arrow)
    t.same(meta, {
      'code.filepath': helperPath,
      'code.function': '(anonymous)',
      'code.lineno': 10
    })
    t.end()
  })

  t.test('should not return code attributes if function name > 255', (t) => {
    const fnName = longString(256)
    const fn = new Function(`return function ${fnName}() {}`)()
    const meta = getCLMMeta(fn)
    t.notOk(meta)
    t.end()
  })

  t.test('failure cases', (t) => {
    t.autoend()
    const fnInspector = require('@contrast/fn-inspect')

    t.beforeEach(() => {
      sinon.stub(fnInspector, 'funcInfo')
    })

    t.afterEach(() => {
      fnInspector.funcInfo.restore()
    })

    t.test('should not return code attributes if filepath > 255', (t) => {
      const longPath = longString(300)
      fnInspector.funcInfo.returns({ lineNumber: 1, method: 'unitTest', file: longPath })
      const meta = getCLMMeta(() => {})
      t.notOk(meta)
      t.end()
    })

    t.test('should only return code.function if retrieving function metadata fails', (t) => {
      const err = new Error('failed to get function meta')
      fnInspector.funcInfo.throws(err)
      function test() {}
      const meta = getCLMMeta(test)
      t.same(meta, {
        'code.function': 'test'
      })
      t.end()
    })

    t.test('should not return code attributes if function name is > 255', (t) => {
      const fnName = longString(256)
      const fn = new Function(`return function ${fnName}() {}`)()
      const err = new Error('oh noes, not again')
      fnInspector.funcInfo.throws(err)
      const meta = getCLMMeta(fn)
      t.notOk(meta)
      t.end()
    })
  })
})
