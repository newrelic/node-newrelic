/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = verifySegments

function verifySegments({ agent, name, children = [], end, assert = require('node:assert') }) {
  const root = agent.getTransaction().trace.root
  assert.equal(root.children.length, 1, 'should have a single child')
  const child = root.children[0]
  assert.equal(child.name, name, 'child segment should have correct name')
  assert.ok(child.timer.touched, 'child should started and ended')
  assert.equal(
    child.children.length,
    1 + children.length,
    'child should have a single callback segment'
  )

  for (let i = 0; i < children.length; ++i) {
    assert.equal(child.children[i].name, children[i])
  }

  const callback = child.children[child.children.length - 1]
  assert.ok(
    callback.name === 'Callback: anonymous' || callback.name === 'Callback: <anonymous>',
    'callback segment should have correct name'
  )

  assert.ok(callback.timer.start, 'callback should have started')
  assert.ok(!callback.timer.touched, 'callback should not have ended')
  setTimeout(function () {
    assert.ok(callback.timer.touched, 'callback should have ended')
    end?.()
  }, 0)
}
