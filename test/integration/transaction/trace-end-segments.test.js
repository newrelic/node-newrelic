/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const test = require('node:test')
const assert = require('node:assert')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent()
  const newrelic = new API(agent)
  ctx.nr = {
    agent,
    newrelic
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('ending segment after transaction', (t, end) => {
  const { agent, newrelic } = t.nr
  let segment = null
  let start = null
  helper.runInTransaction(agent, (tx) => {
    const segmentName = 'my-tracer'
    newrelic.startSegment(
      segmentName,
      false,
      (cb) => {
        segment = agent.tracer.getSegment()
        assert.equal(segment.name, segmentName, 'should be the segment we created')
        assert.ok(segment.timer.isRunning(), 'timer should have automatically been started')
        start = segment.getDurationInMillis()

        tx.end()
        setImmediate(cb, tx)
      },
      finish
    )

    function finish() {
      assert.ok(!segment.timer.isActive(), 'segment timer should have been stopped by tx end')

      assert.ok(segment.getDurationInMillis() > start, 'time should have been updated')

      const totalTime = tx.trace.getTotalTimeDurationInMillis()
      assert.ok(totalTime > 0, 'transaction should have a totalTime')

      assert.equal(segment.name, 'Truncated/my-tracer', 'name should have Truncated/ prefix')

      end()
    }
  })
})

test('segment ended before tx ends should not have Truncated prefix', (t, end) => {
  const { agent, newrelic } = t.nr
  let segment = null
  let start = null
  helper.runInTransaction(agent, (tx) => {
    const segmentName = 'my-tracer'
    newrelic.startSegment(
      segmentName,
      false,
      (cb) => {
        segment = agent.tracer.getSegment()
        assert.ok(segment.timer.isRunning(), 'timer should have automatically been started')
        start = segment.getDurationInMillis()
        cb()
      },
      finish
    )

    function finish() {
      tx.end()
      assert.ok(!segment.timer.isActive(), 'segment timer should have been stopped by tx end')

      assert.ok(segment.getDurationInMillis() > start, 'time should have been updated')

      const totalTime = tx.trace.getTotalTimeDurationInMillis()
      assert.ok(totalTime > 0, 'transaction should have a totalTime')
      assert.equal(segment.name, segmentName, 'should have original segment name')

      end()
    }
  })
})

test('touching a segment', (t, end) => {
  const { agent, newrelic } = t.nr
  let segment = null
  helper.runInTransaction(agent, (tx) => {
    const segmentName = 'my-tracer'
    newrelic.startSegment(
      segmentName,
      false,
      (cb) => {
        segment = agent.tracer.getSegment()
        assert.equal(segment.name, segmentName, 'should be the segment we created')
        assert.ok(segment.timer.isRunning(), 'timer should have automatically been started')

        segment.touch()
        assert.ok(segment.timer.isRunning(), 'timer should still be running after touch')

        cb()
      },
      finish
    )

    function finish() {
      tx.end()
      assert.ok(!segment.timer.isActive(), 'segment timer should have been stopped by tx end')

      const totalTime = tx.trace.getTotalTimeDurationInMillis()
      assert.ok(totalTime > 0, 'transaction should have a totalTime')

      // blow away the cache to force a fresh grab of data.
      tx.trace.totalTimeCache = null

      assert.equal(
        totalTime,
        tx.trace.getTotalTimeDurationInMillis(),
        'should not update the total time'
      )

      assert.equal(segment.name, segmentName, 'should have original segment name')

      end()
    }
  })
})
