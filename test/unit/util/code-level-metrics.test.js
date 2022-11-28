/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const getCLMMeta = require('../../../lib/util/code-level-metrics')

tap.test('CLM Meta', (t) => {
  t.autoend()

  t.test('should return function name as code.function from function reference', (t) => {
    function testFunction() {}
    const meta = getCLMMeta(testFunction)
    t.same(meta, {
      'code.function': 'testFunction'
    })
    t.end()
  })

  t.test('should return variable name as code.function from function reference', (t) => {
    const testFunction = function () {}
    const meta = getCLMMeta(testFunction)
    t.same(meta, {
      'code.function': 'testFunction'
    })
    t.end()
  })

  t.test(
    'should return function name not variable name as code.function from function reference',
    (t) => {
      const testFunction = function realFunction() {}
      const meta = getCLMMeta(testFunction)
      t.same(meta, {
        'code.function': 'realFunction'
      })
      t.end()
    }
  )

  t.test('should return anonymous as code.function from anonymous function reference', (t) => {
    const meta = getCLMMeta(function () {})
    t.same(meta, {
      'code.function': 'anonymous'
    })
    t.end()
  })

  t.test('should return anonymous as code.function from arrow function reference', (t) => {
    const meta = getCLMMeta(() => {})
    t.same(meta, {
      'code.function': 'anonymous'
    })
    t.end()
  })
})
