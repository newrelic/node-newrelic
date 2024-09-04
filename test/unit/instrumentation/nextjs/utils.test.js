/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const { assignCLMAttrs } = require('../../../../lib/instrumentation/nextjs/utils')

test('assignCLMAttrs', async (t) => {
  const config = { code_level_metrics: { enabled: true } }

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.segmentStub = {
      addAttribute: sinon.stub()
    }
  })

  await t.test('should add attrs to segment', (t, end) => {
    const { segmentStub } = t.nr
    const attrs = {
      'code.function': 'foo',
      'code.filepath': 'pages/foo/bar'
    }
    assignCLMAttrs(config, segmentStub, attrs)
    assert.equal(segmentStub.addAttribute.callCount, 2)
    assert.deepEqual(segmentStub.addAttribute.args, [
      ['code.function', 'foo'],
      ['code.filepath', 'pages/foo/bar']
    ])
    end()
  })

  await t.test('should not add attr is code_level_metrics is disabled', (t, end) => {
    const { segmentStub } = t.nr
    config.code_level_metrics = null
    assignCLMAttrs(config, segmentStub)
    assert.ok(!segmentStub.addAttribute.callCount)
    end()
  })

  await t.test('should not add attribute if segment is undefined', (t, end) => {
    const { segmentStub } = t.nr
    assignCLMAttrs(config, null)
    assert.ok(!segmentStub.addAttribute.callCount)
    end()
  })
})
