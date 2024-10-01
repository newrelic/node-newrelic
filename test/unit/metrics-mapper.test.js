/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const MetricMapper = require('../../lib/metrics/mapper.js')

test("shouldn't throw if passed null", () => {
  try {
    new MetricMapper().load(null)
  } catch (error) {
    assert.ifError(error)
  }
})

test("shouldn't throw if passed undefined", () => {
  try {
    new MetricMapper().load(undefined)
  } catch (error) {
    assert.ifError(error)
  }
})

test("shouldn't throw if passed an empty list", () => {
  try {
    new MetricMapper().load([])
  } catch (error) {
    assert.ifError(error)
  }
})

test("shouldn't throw if passed garbage input", () => {
  try {
    new MetricMapper().load({ name: 'garbage' }, 1001)
  } catch (error) {
    assert.ifError(error)
  }
})

test('when loading mappings at creation', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.mapper = new MetricMapper([
      [{ name: 'Test/RenameMe1' }, 1001],
      [{ name: 'Test/RenameMe2', scope: 'TEST' }, 1002]
    ])
  })

  await t.test('should have loaded all the mappings', (t) => {
    const { mapper } = t.nr
    assert.equal(mapper.length, 2)
  })

  await t.test('should apply mappings', (t) => {
    const { mapper } = t.nr
    assert.equal(mapper.map('Test/RenameMe1'), 1001)
    assert.equal(mapper.map('Test/RenameMe2', 'TEST'), 1002)
  })

  await t.test('should turn non-mapped metrics into specs', (t) => {
    const { mapper } = t.nr
    assert.deepEqual(mapper.map('Test/Metric1'), { name: 'Test/Metric1' })
    assert.deepEqual(mapper.map('Test/Metric2', 'TEST'), { name: 'Test/Metric2', scope: 'TEST' })
  })
})

test('when adding mappings after creation', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {
      mapper: new MetricMapper()
    }
    ctx.nr.mapper.load([[{ name: 'Test/RenameMe1' }, 1001]])
    ctx.nr.mapper.load([[{ name: 'Test/RenameMe2', scope: 'TEST' }, 1002]])
  })

  await t.test('should have loaded all the mappings', (t) => {
    const { mapper } = t.nr
    assert.equal(mapper.length, 2)
  })

  await t.test('should apply mappings', (t) => {
    const { mapper } = t.nr
    assert.equal(mapper.map('Test/RenameMe1'), 1001)
    assert.equal(mapper.map('Test/RenameMe2', 'TEST'), 1002)
  })

  await t.test('should turn non-mapped metrics into specs', (t) => {
    const { mapper } = t.nr
    assert.deepEqual(mapper.map('Test/Metric1'), { name: 'Test/Metric1' })
    assert.deepEqual(mapper.map('Test/Metric2', 'TEST'), { name: 'Test/Metric2', scope: 'TEST' })
  })
})
