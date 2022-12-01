/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const addCLMAttributes = require('../../../lib/util/code-level-metrics')
const { anon, arrow, named } = require('../../lib/clm-helper')
const path = require('path')
const helperPath = path.resolve(`${__dirname}/../../lib/clm-helper.js`)
const sinon = require('sinon')
const symbols = require('../../../lib/symbols')
tap.Test.prototype.addAssert('clmAttrs', 2, function clmAttrs(segmentStub, expectedAttrs) {
  const attrs = segmentStub.addAttribute.args
  const attrsObj = attrs.reduce((obj, [key, value]) => {
    obj[key] = value
    return obj
  }, {})
  this.same(attrsObj, expectedAttrs, 'CLM attrs should match')
})

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
  let segmentStub

  t.beforeEach(() => {
    segmentStub = {
      addAttribute: sinon.stub()
    }
  })

  t.test('should return function name as code.function from function reference', (t) => {
    function testFunction() {}
    testFunction[symbols.clm] = true
    addCLMAttributes(testFunction, segmentStub)
    t.clmAttrs(segmentStub, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 46,
      'code.column': 25
    })
    t.end()
  })

  t.test('should return variable name as code.function from function reference', (t) => {
    const testFunction = function () {}
    testFunction[symbols.clm] = true
    addCLMAttributes(testFunction, segmentStub)
    t.clmAttrs(segmentStub, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 59,
      'code.column': 34
    })
    t.end()
  })

  t.test(
    'should return function name not variable name as code.function from function reference',
    (t) => {
      named[symbols.clm] = true
      addCLMAttributes(named, segmentStub)
      t.clmAttrs(segmentStub, {
        'code.filepath': helperPath,
        'code.function': 'testFunction',
        'code.lineno': 11,
        'code.column': 39
      })
      t.end()
    }
  )

  t.test('should return (anonymous) as code.function from (anonymous) function reference', (t) => {
    anon[symbols.clm] = true
    addCLMAttributes(anon, segmentStub)
    t.clmAttrs(segmentStub, {
      'code.filepath': helperPath,
      'code.function': '(anonymous)',
      'code.lineno': 9,
      'code.column': 26
    })
    t.end()
  })

  t.test('should return (anonymous) as code.function from arrow function reference', (t) => {
    arrow[symbols.clm] = true
    addCLMAttributes(arrow, segmentStub)
    t.clmAttrs(segmentStub, {
      'code.filepath': helperPath,
      'code.function': '(anonymous)',
      'code.lineno': 10,
      'code.column': 18
    })
    t.end()
  })

  t.test('should not return code attributes if function name > 255', (t) => {
    const fnName = longString(256)
    const fn = new Function(`return function ${fnName}() {}`)()
    fn[symbols.clm] = true
    addCLMAttributes(fn, segmentStub)
    t.notOk(segmentStub.addAttribute.callCount)
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

    t.test('should not try to get function metadata if clm symbol does not exist', (t) => {
      addCLMAttributes(() => {}, segmentStub)
      t.notOk(fnInspector.funcInfo.callCount, 'should not call funcInfo')
      t.notOk(segmentStub.addAttribute.callCount, 'should not call segment.addAttribute')
      t.end()
    })

    t.test('should not return code attributes if filepath > 255', (t) => {
      const longPath = longString(300)
      fnInspector.funcInfo.returns({ lineNumber: 1, method: 'unitTest', file: longPath })
      const fn = () => {}
      fn[symbols.clm] = true
      addCLMAttributes(fn, segmentStub)
      t.notOk(segmentStub.addAttribute.callCount)
      t.end()
    })

    t.test('should only return code.function if retrieving function metadata fails', (t) => {
      const err = new Error('failed to get function meta')
      fnInspector.funcInfo.throws(err)
      function test() {}
      test[symbols.clm] = true
      addCLMAttributes(test, segmentStub)
      t.equal(segmentStub.addAttribute.callCount, 1)
      t.same(segmentStub.addAttribute.args[0], ['code.function', 'test'])
      t.end()
    })

    t.test('should not return code attributes if function name is > 255', (t) => {
      const fnName = longString(256)
      const fn = new Function(`return function ${fnName}() {}`)()
      fn[symbols.clm] = true
      const err = new Error('oh noes, not again')
      fnInspector.funcInfo.throws(err)
      addCLMAttributes(fn, segmentStub)
      t.notOk(segmentStub.addAttribute.callCount)
      t.end()
    })
  })
})
