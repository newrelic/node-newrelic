/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('totaltime: single segment', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const only = root.add('only')
    only.timer.setDurationInMillis(1000, start)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 1000)
    end()
  })
})

test('totaltime: parent with child not overlapping', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 1000)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 2000)
    end()
  })
})

test('totaltime: parent with a child overlapping by 500ms', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 500)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 1500)
    end()
  })
})

test('totaltime: 1 parent, 2 parallel equal children no overlap with parent', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const first = parent.add('first')
    first.timer.setDurationInMillis(1000, start + 1000)

    const second = parent.add('second')
    second.timer.setDurationInMillis(1000, start + 1000)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 3000)
    end()
  })
})

test('totaltime: 1 parent, 2 parallel equal children one overlaps with parent by 500ms', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const first = parent.add('first')
    first.timer.setDurationInMillis(1000, start + 1000)

    const second = parent.add('second')
    second.timer.setDurationInMillis(1000, start + 500)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 2500)
    end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, all at same time', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = parent.add('child')
    child.timer.setDurationInMillis(1000, start)

    const grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 1000)
    end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, 500ms at each step', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 500)

    const grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start + 1000)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 2000)
    end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, 250ms after previous start', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 250)

    const grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start + 500)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 1500)
    end()
  })
})

test('totaltime: 1 child ending before parent, 1 grand child ending after parent', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const root = transaction.trace.root

    const parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = parent.add('child')
    child.timer.setDurationInMillis(200, start + 100)

    const grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start + 200)

    assert.equal(transaction.trace.getTotalTimeDurationInMillis(), 1200)
    end()
  })
})
