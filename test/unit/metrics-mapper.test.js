/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const MetricMapper = require('../../lib/metrics/mapper.js')

tap.test('MetricMapper', function (t) {
  t.test("shouldn't throw if passed null", function (t) {
    t.doesNotThrow(function () {
      new MetricMapper().load(null)
    })
    t.end()
  })

  t.test("shouldn't throw if passed undefined", function (t) {
    t.doesNotThrow(function () {
      new MetricMapper().load(undefined)
    })
    t.end()
  })

  t.test("shouldn't throw if passed an empty list", function (t) {
    t.doesNotThrow(function () {
      new MetricMapper().load([])
    })
    t.end()
  })

  t.test("shouldn't throw if passed garbage input", function (t) {
    t.doesNotThrow(function () {
      new MetricMapper().load({ name: 'garbage' }, 1001)
    })
    t.end()
  })

  t.test('when loading mappings at creation', function (t) {
    let mapper

    t.before(function () {
      mapper = new MetricMapper([
        [{ name: 'Test/RenameMe1' }, 1001],
        [{ name: 'Test/RenameMe2', scope: 'TEST' }, 1002]
      ])
    })

    t.test('should have loaded all the mappings', function (t) {
      t.equal(mapper.length, 2)
      t.end()
    })

    t.test('should apply mappings', function (t) {
      t.equal(mapper.map('Test/RenameMe1'), 1001)
      t.equal(mapper.map('Test/RenameMe2', 'TEST'), 1002)
      t.end()
    })

    t.test('should turn non-mapped metrics into specs', function (t) {
      t.same(mapper.map('Test/Metric1'), { name: 'Test/Metric1' })
      t.same(mapper.map('Test/Metric2', 'TEST'), { name: 'Test/Metric2', scope: 'TEST' })
      t.end()
    })
    t.end()
  })

  t.test('when adding mappings after creation', function (t) {
    const mapper = new MetricMapper()

    t.before(function () {
      mapper.load([[{ name: 'Test/RenameMe1' }, 1001]])
      mapper.load([[{ name: 'Test/RenameMe2', scope: 'TEST' }, 1002]])
    })

    t.test('should have loaded all the mappings', function (t) {
      t.equal(mapper.length, 2)
      t.end()
    })

    t.test('should apply mappings', function (t) {
      t.equal(mapper.map('Test/RenameMe1'), 1001)
      t.equal(mapper.map('Test/RenameMe2', 'TEST'), 1002)
      t.end()
    })

    t.test('should turn non-mapped metrics into specs', function (t) {
      t.same(mapper.map('Test/Metric1'), { name: 'Test/Metric1' })
      t.same(mapper.map('Test/Metric2', 'TEST'), { name: 'Test/Metric2', scope: 'TEST' })
      t.end()
    })
    t.end()
  })
  t.end()
})
