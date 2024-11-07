/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = verifySegments

function verifySegments(t, agent, name, extras, done) {
  const { trace } = agent.getTransaction()
  const children = trace.getChildren(trace.root.id)
  if (!extras) {
    extras = []
  }
  t.equal(children.length, 1, 'should have a single child')
  const child = children[0]
  const childChildren = trace.getChildren(child.id)
  t.equal(child.name, name, 'child segment should have correct name')
  t.ok(child.timer.touched, 'child should started and ended')
  t.equal(childChildren.length, 1 + extras.length, 'child should have a single callback segment')

  for (let i = 0; i < extras.length; ++i) {
    t.equal(childChildren[i].name, extras[i])
  }

  const callback = childChildren[childChildren.length - 1]
  t.ok(
    callback.name === 'Callback: anonymous' || callback.name === 'Callback: <anonymous>',
    'callback segment should have correct name'
  )

  t.ok(callback.timer.start, 'callback should have started')
  t.notOk(callback.timer.touched, 'callback should not have ended')
  setTimeout(function () {
    t.ok(callback.timer.touched, 'callback should have ended')
    done ? done() : t.end()
  }, 0)
}
