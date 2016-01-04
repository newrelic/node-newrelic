var test = require('tap').test
var helper = require('../../lib/agent_helper')

var TO_NANO_FROM_MILLI = 1e6

test('totaltime: single segment', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var only = root.add('only')
    only.timer.setDurationInMillis(1000, start)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1000)
    t.end()
  })
})

test('totaltime: parent with child not overlapping', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 1000)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 2000)
    t.end()
  })
})

test('totaltime: parent with a child overlapping by 500ms', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 500)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1500)
    t.end()
  })
})

test('totaltime: 1 parent, 2 parallel equal children no overlap with parent', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var first = parent.add('first')
    first.timer.setDurationInMillis(1000, start + 1000)

    var second = parent.add('second')
    second.timer.setDurationInMillis(1000, start + 1000)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 3000)
    t.end()
  })
})

test('totaltime: 1 parent, 2 parallel equal children one overlaps with parent by 500ms', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var first = parent.add('first')
    first.timer.setDurationInMillis(1000, start + 1000)

    var second = parent.add('second')
    second.timer.setDurationInMillis(1000, start + 500)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 2500)
    t.end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, all at same time', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var child = parent.add('child')
    child.timer.setDurationInMillis(1000, start)

    var grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1000)
    t.end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, 500ms at each step', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 500)

    var grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start + 1000)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 2000)
    t.end()
  })
})

test('totaltime: 1 parent, 1 child, 1 grand child, 250ms after previous start', function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var child = parent.add('child')
    child.timer.setDurationInMillis(1000, start + 250)

    var grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start + 500)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1500)
    t.end()
  })
})

test('totaltime: 1 child ending before parent, 1 grand child ending after parent',
    function (t) {
  var agent = getAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    var start = Date.now()
    var root = transaction.trace.root

    var parent = root.add('parent')
    parent.timer.setDurationInMillis(1000, start)

    var child = parent.add('child')
    child.timer.setDurationInMillis(200, start + 100)

    var grandchild = child.add('grandchild')
    grandchild.timer.setDurationInMillis(1000, start + 200)

    t.equal(transaction.trace.getTotalTimeDurationInMillis(), 1200)
    t.end()
  })
})

function getAgent(t) {
  var agent = helper.loadMockedAgent()

  t.tearDown(function () {
    helper.unloadAgent(agent)
  })

  return agent
}
