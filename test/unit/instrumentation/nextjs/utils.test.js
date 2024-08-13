/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const { assignCLMAttrs } = require('../../../../lib/instrumentation/nextjs/utils')

tap.test('assignCLMAttrs', (t) => {
  t.autoend()
  const config = { code_level_metrics: { enabled: true } }
  let segmentStub

  t.beforeEach(() => {
    segmentStub = {
      addAttribute: sinon.stub()
    }
  })

  t.test('should add attrs to segment', (t) => {
    const attrs = {
      'code.function': 'foo',
      'code.filepath': 'pages/foo/bar'
    }
    assignCLMAttrs(config, segmentStub, attrs)
    t.equal(segmentStub.addAttribute.callCount, 2)
    t.same(segmentStub.addAttribute.args, [
      ['code.function', 'foo'],
      ['code.filepath', 'pages/foo/bar']
    ])
    t.end()
  })

  t.test('should not add attr is code_level_metrics is disabled', (t) => {
    config.code_level_metrics = null
    assignCLMAttrs(config, segmentStub)
    t.notOk(segmentStub.addAttribute.callCount)
    t.end()
  })

  t.test('should not add attribute if segment is undefined', (t) => {
    assignCLMAttrs(config, null)
    t.notOk(segmentStub.addAttribute.callCount)
    t.end()
  })
})
