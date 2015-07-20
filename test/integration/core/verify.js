'use strict'

module.exports = verifySegments

function verifySegments(t, agent, name, extras, done) {
  var root = agent.getTransaction().trace.root
  if (!extras) extras = []
  t.equal(root.children.length, 1, 'should have a single child')
  var child = root.children[0]
  t.equal(child.name, name, 'child segment should have correct name')
  t.ok(child.timer.touched, 'child should started and ended')
  t.equal(
    child.children.length,
    1 + extras.length,
    'child should have a single callback segment'
  )

  for (var i = 0; i < extras.length; ++i) {
    t.equal(child.children[i].name, extras[i])
  }

  var callback = child.children[child.children.length - 1]
  t.equal(
    callback.name,
    'Callback: anonymous',
    'callback segment should have correct name'
  )

  t.ok(callback.timer.start, 'callback should have started')
  t.notOk(callback.timer.touched, 'callback should not have ended')
  setTimeout(function() {
    t.ok(callback.timer.touched, 'callback should have ended')
    done ? done() : t.end()
  }, 0)
}
