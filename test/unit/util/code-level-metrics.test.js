/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { addCLMAttributes } = require('../../../lib/util/code-level-metrics')
const { anon, arrow, named } = require('../../lib/clm-helper')
const path = require('path')
const helperPath = path.resolve(`${__dirname}/../../lib/clm-helper.js`)
const sinon = require('sinon')
const symbols = require('../../../lib/symbols')
const { assertExactClmAttrs } = require('../../lib/custom-assertions')

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

test('CLM Meta', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.segmentStub = {
      addAttribute: sinon.stub()
    }
  })

  await t.test('should return function name as code.function from function reference', (t) => {
    const { segmentStub } = t.nr
    function testFunction() {}
    testFunction[symbols.clm] = true
    addCLMAttributes(testFunction, segmentStub)
    assertExactClmAttrs(segmentStub, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 38,
      'code.column': 26
    })
  })

  await t.test('should return variable name as code.function from function reference', (t) => {
    const { segmentStub } = t.nr
    const testFunction = function () {}
    testFunction[symbols.clm] = true
    addCLMAttributes(testFunction, segmentStub)
    assertExactClmAttrs(segmentStub, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 51,
      'code.column': 35
    })
  })

  await t.test(
    'should return function name not variable name as code.function from function reference',
    (t) => {
      const { segmentStub } = t.nr
      named[symbols.clm] = true
      addCLMAttributes(named, segmentStub)
      assertExactClmAttrs(segmentStub, {
        'code.filepath': helperPath,
        'code.function': 'testFunction',
        'code.lineno': 11,
        'code.column': 40
      })
    }
  )

  await t.test(
    'should return (anonymous) as code.function from (anonymous) function reference',
    (t) => {
      const { segmentStub } = t.nr
      anon[symbols.clm] = true
      addCLMAttributes(anon, segmentStub)
      assertExactClmAttrs(segmentStub, {
        'code.filepath': helperPath,
        'code.function': '(anonymous)',
        'code.lineno': 9,
        'code.column': 27
      })
    }
  )

  await t.test('should return (anonymous) as code.function from arrow function reference', (t) => {
    const { segmentStub } = t.nr
    arrow[symbols.clm] = true
    addCLMAttributes(arrow, segmentStub)
    assertExactClmAttrs(segmentStub, {
      'code.filepath': helperPath,
      'code.function': '(anonymous)',
      'code.lineno': 10,
      'code.column': 19
    })
  })

  await t.test('should not add CLM attrs when filePath is null', (t) => {
    const { segmentStub } = t.nr
    function fn() {}
    // This is testing Express router.route which binds a function thus breaking any function metadata
    const boundFn = fn.bind(null)
    boundFn[symbols.clm] = true
    addCLMAttributes(boundFn, segmentStub)
    assert.ok(!segmentStub.addAttribute.callCount)
  })

  await t.test('should not return code attributes if function name > 255', (t) => {
    const { segmentStub } = t.nr
    const fnName = longString(256)
    const fn = new Function(`return function ${fnName}() {}`)()
    fn[symbols.clm] = true
    addCLMAttributes(fn, segmentStub)
    assert.ok(!segmentStub.addAttribute.callCount)
  })
})

test('failure cases', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.segmentStub = {
      addAttribute: sinon.stub()
    }
    const fnInspector = require('@contrast/fn-inspect')
    sinon.stub(fnInspector, 'funcInfo')
    ctx.nr.fnInspector = fnInspector
  })

  t.afterEach((ctx) => {
    ctx.nr.fnInspector.funcInfo.restore()
  })

  await t.test('should not try to get function metadata if clm symbol does not exist', (t) => {
    const { fnInspector, segmentStub } = t.nr
    addCLMAttributes(() => {}, segmentStub)
    assert.ok(!fnInspector.funcInfo.callCount, 'should not call funcInfo')
    assert.ok(!segmentStub.addAttribute.callCount, 'should not call segment.addAttribute')
  })

  await t.test('should not return code attributes if filepath > 255', (t) => {
    const { fnInspector, segmentStub } = t.nr
    const longPath = longString(300)
    fnInspector.funcInfo.returns({ lineNumber: 1, method: 'unitTest', file: longPath })
    const fn = () => {}
    fn[symbols.clm] = true
    addCLMAttributes(fn, segmentStub)
    assert.ok(!segmentStub.addAttribute.callCount)
  })

  await t.test('should only return code.function if retrieving function metadata fails', (t) => {
    const { fnInspector, segmentStub } = t.nr
    const err = new Error('failed to get function meta')
    fnInspector.funcInfo.throws(err)
    function testFn() {}
    testFn[symbols.clm] = true
    addCLMAttributes(testFn, segmentStub)
    assert.equal(segmentStub.addAttribute.callCount, 1)
    assert.deepEqual(segmentStub.addAttribute.args[0], ['code.function', 'testFn'])
  })

  await t.test('should not return code attributes if function name is > 255', (t) => {
    const { fnInspector, segmentStub } = t.nr
    const fnName = longString(256)
    const fn = new Function(`return function ${fnName}() {}`)()
    fn[symbols.clm] = true
    const err = new Error('oh noes, not again')
    fnInspector.funcInfo.throws(err)
    addCLMAttributes(fn, segmentStub)
    assert.ok(!segmentStub.addAttribute.callCount)
  })
})
