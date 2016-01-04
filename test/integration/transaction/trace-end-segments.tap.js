var API = require('../../../api')
var helper = require('../../lib/agent_helper')
var test = require('tap').test

test('running custom segment should have its timer ended', function (t) {
  var agent = helper.loadTestAgent(t)
  var newrelic = new API(agent)
  helper.runInTransaction(agent, function (transaction) {
    var segmentName = 'my-tracer'
    // createTracer creates a segment as a child of the current segment and
    // immediately starts the timer.
    var tracedFn = newrelic.createTracer(segmentName, noop)

    var parent = agent.tracer.getSegment()
    // Mostly to make sure we're grabbing the right node.
    t.equal(parent.children.length, 1, 'should only have the child we created')
    var segment = parent.children[0]
    t.equal(segment.name, segmentName, 'should be the segment we created')

    t.ok(segment.timer.isRunning(), 'timer should have automatically been started')

    // In a timeout to give it some duration above 0.
    setTimeout(function () {
      transaction.end(function () {
        t.notOk(
          segment.timer.isActive(),
          'segment timer should have been stopped by tx end'
        )
        var duration = segment.getDurationInMillis()
        var totalTime = transaction.trace.getTotalTimeDurationInMillis()

        t.ok(duration > 0, 'segment should have a duration')
        t.ok(totalTime > 0, 'transaction should have a totalTime')

        tracedFn() // call the traced function to end that work.

        t.equal(
          duration,
          segment.getDurationInMillis(),
          'should not update segment duration'
        )

        // blow away the cache to force a fresh grab of data.
        transaction.trace.totalTimeCache = null

        t.equal(
          totalTime,
          transaction.trace.getTotalTimeDurationInMillis(),
          'should not update the total time'
        )
        t.end()
      })
    }, 50)
  })
})


test('touched custom segment should have its timer ended', function (t) {
  var agent = helper.loadTestAgent(t)
  var newrelic = new API(agent)
  helper.runInTransaction(agent, function (transaction) {
    var segmentName = 'my-tracer'
    // createTracer creates a segment as a child of the current segment and
    // immediately starts the timer.
    var tracedFn = newrelic.createTracer(segmentName, noop)

    var parent = agent.tracer.getSegment()
    // Mostly to make sure we're grabbing the right node.
    t.equal(parent.children.length, 1, 'should only have the child we created')
    var segment = parent.children[0]
    t.equal(segment.name, segmentName, 'should be the segment we created')

    t.ok(segment.timer.isRunning(), 'timer should have automatically been started')

    // In a timeout to give it some duration above 0.
    setTimeout(function () {
      segment.touch()
      t.ok(segment.timer.isRunning(), 'timer should still be running')

      var touchDuration = segment.getDurationInMillis()

      setTimeout(function () {
        transaction.end(function () {
          t.notOk(
            segment.timer.isActive(),
            'segment timer should have been stopped by tx end'
          )
          var duration = segment.getDurationInMillis()
          var totalTime = transaction.trace.getTotalTimeDurationInMillis()

          t.ok(duration > 0, 'segment should have a duration')
          t.ok(totalTime > 0, 'transaction should have a totalTime')

          tracedFn()

          t.equal(
            duration,
            touchDuration,
            'segment duration should not have been updated'
          )

          // blow away the cache to force a fresh grab of data.
          transaction.trace.totalTimeCache = null

          t.equal(
            totalTime,
            transaction.trace.getTotalTimeDurationInMillis(),
            'should not update the total time'
          )

          t.end()
        })
      }, 50)
    }, 10)
  })
})

function noop () {}
