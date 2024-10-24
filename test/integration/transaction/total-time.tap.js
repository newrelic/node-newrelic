/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

test('totaltime: single segment', function (t) {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const only = transaction.trace.add('only')
    only.timer.setDurationInMillis(1000, start)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1000)
    t.end()
  })
})

test('totaltime: parent with child not overlapping', function (t) {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = transaction.trace.add('child')
    child.timer.setDurationInMillis(1000, start + 1000)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 2000)
    t.end()
  })
})

test('totaltime: parent with a child overlapping by 500ms', function (t) {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()

    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = transaction.trace.add('child', null, parent)
    child.timer.setDurationInMillis(1000, start + 500)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1500)
    t.end()
  })
})

test('totaltime: 1 parent, 2 parallel equal children no overlap with parent', (t) => {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const first = transaction.trace.add('first', null, parent)
    first.timer.setDurationInMillis(1000, start + 1000)

    const second = transaction.trace.add('second', null, parent)
    second.timer.setDurationInMillis(1000, start + 1000)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 3000)
    t.end()
  })
})

test('totaltime: 1 parent, 2 parallel equal children one overlaps with parent by 500ms', function (t) {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const first = transaction.trace.add('first', null, parent)
    first.timer.setDurationInMillis(1000, start + 1000)

    const second = transaction.trace.add('second', null, parent)
    second.timer.setDurationInMillis(1000, start + 500)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 2500)
    t.end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, all at same time', function (t) {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = transaction.trace.add('child', null, parent)
    child.timer.setDurationInMillis(1000, start)

    const grandchild = transaction.trace.add('grandchild', null, child)
    grandchild.timer.setDurationInMillis(1000, start)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1000)
    t.end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, 500ms at each step', function (t) {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = transaction.trace.add('child', null, parent)
    child.timer.setDurationInMillis(1000, start + 500)

    const grandchild = transaction.trace.add('grandchild', null, child)
    grandchild.timer.setDurationInMillis(1000, start + 1000)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 2000)
    t.end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, 250ms after previous start', (t) => {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()

    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = transaction.trace.add('child', null, parent)
    child.timer.setDurationInMillis(1000, start + 250)

    const grandchild = transaction.trace.add('grandchild', null, child)
    grandchild.timer.setDurationInMillis(1000, start + 500)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1500)
    t.end()
  })
})

test('totaltime: 1 child ending before parent, 1 grand child ending after parent', function (t) {
  const agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const start = Date.now()
    const parent = transaction.trace.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    const child = transaction.trace.add('child', null, parent)
    child.timer.setDurationInMillis(200, start + 100)

    const grandchild = transaction.trace.add('grandchild', null, child)
    grandchild.timer.setDurationInMillis(1000, start + 200)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1200)
    t.end()
  })
})

function getAgent(t) {
  const agent = helper.loadMockedAgent()

  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  return agent
}
