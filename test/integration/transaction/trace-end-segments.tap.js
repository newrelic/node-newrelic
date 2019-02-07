'use strict'

const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const test = require('tap').test

test('ending segment after transaction', (t) => {
  const agent = helper.loadTestAgent(t)
  const newrelic = new API(agent)
  let segment = null
  let start = null
  helper.runInTransaction(agent, (tx) => {
    const segmentName = 'my-tracer'
    newrelic.startSegment(segmentName, false, (cb) => {
      segment = agent.tracer.getSegment()
      t.equal(segment.name, segmentName, 'should be the segment we created')
      t.ok(segment.timer.isRunning(), 'timer should have automatically been started')
      start = segment.getDurationInMillis()

      tx.end()
      setImmediate(cb, tx)
    }, finish)

    function finish() {
      t.notOk(
        segment.timer.isActive(),
        'segment timer should have been stopped by tx end'
      )

      t.ok(
        segment.getDurationInMillis() > start,
        'time should have been updated'
      )

      const totalTime = tx.trace.getTotalTimeDurationInMillis()
      t.ok(totalTime > 0, 'transaction should have a totalTime')

      t.equal(
        segment.name,
        'Truncated/my-tracer',
        'name should have Truncated/ prefix'
      )

      t.end()
    }
  })
})

test('segment ended before tx ends should not have Truncated prefix', (t) => {
  const agent = helper.loadTestAgent(t)
  const newrelic = new API(agent)
  let segment = null
  let start = null
  helper.runInTransaction(agent, (tx) => {
    const segmentName = 'my-tracer'
    newrelic.startSegment(segmentName, false, (cb) => {
      segment = agent.tracer.getSegment()
      t.ok(segment.timer.isRunning(), 'timer should have automatically been started')
      start = segment.getDurationInMillis()
      cb()
    }, finish)

    function finish() {
      tx.end()
      t.notOk(
        segment.timer.isActive(),
        'segment timer should have been stopped by tx end'
      )

      t.ok(
        segment.getDurationInMillis() > start,
        'time should have been updated'
      )

      const totalTime = tx.trace.getTotalTimeDurationInMillis()
      t.ok(totalTime > 0, 'transaction should have a totalTime')
      t.equal(segment.name, segmentName, 'should have original segment name')

      t.end()
    }
  })
})

test('touching a segment', (t) => {
  const agent = helper.loadTestAgent(t)
  const newrelic = new API(agent)
  let segment = null
  helper.runInTransaction(agent, (tx) => {
    const segmentName = 'my-tracer'
    newrelic.startSegment(segmentName, false, (cb) => {
      segment = agent.tracer.getSegment()
      t.equal(segment.name, segmentName, 'should be the segment we created')
      t.ok(segment.timer.isRunning(), 'timer should have automatically been started')

      segment.touch()
      t.ok(segment.timer.isRunning(), 'timer should still be running after touch')

      cb()
    }, finish)

    function finish() {
      tx.end()
      t.notOk(
        segment.timer.isActive(),
        'segment timer should have been stopped by tx end'
      )

      const totalTime = tx.trace.getTotalTimeDurationInMillis()
      t.ok(totalTime > 0, 'transaction should have a totalTime')

      // blow away the cache to force a fresh grab of data.
      tx.trace.totalTimeCache = null

      t.equal(
        totalTime,
        tx.trace.getTotalTimeDurationInMillis(),
        'should not update the total time'
      )

      t.equal(segment.name, segmentName, 'should have original segment name')

      t.end()
    }
  })
})
