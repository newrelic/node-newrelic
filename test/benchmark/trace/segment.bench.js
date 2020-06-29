/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const benchmark = require('../../lib/benchmark')
const Segment = require('../../../lib/transaction/trace/segment')

const agent = helper.loadMockedAgent()
const tx = helper.runInTransaction(agent, (_tx) => _tx)

const suite = benchmark.createBenchmark({
  name: 'trace segments'
})

var root

function addChildren(rootSegment, numChildren) {
  const queue = [rootSegment]
  for (var numSegments = 1; numSegments < 900; numSegments += numChildren) {
    var parent = queue.shift()
    for (var i = 0; i < numChildren; ++i) {
      var child = parent.add('child ' + (numSegments + i))
      child.timer.setDurationInMillis(
        (0.99 + Math.random() / 100) * parent.timer.durationInMillis,
        parent.timer.start + 1
      )
      queue.push(child)
    }
  }
}

suite.add({
  name: 'toJSON flat',

  before: function buildTree() {
    root = new Segment(tx, 'ROOT')
    root.timer.setDurationInMillis(10000, Date.now())
    addChildren(root, 899)
  },
  fn: function() {
    return root.toJSON()
  }
})

suite.add({
  name: 'toJSON linear',

  before: function buildTree() {
    root = new Segment(tx, 'ROOT')
    root.timer.setDurationInMillis(10000, Date.now())
    addChildren(root, 1)
  },
  fn: function() {
    return root.toJSON()
  }
})

suite.add({
  name: 'toJSON binary',

  before: function buildTree() {
    root = new Segment(tx, 'ROOT')
    root.timer.setDurationInMillis(10000, Date.now())
    addChildren(root, 2)
  },
  fn: function() {
    return root.toJSON()
  }
})

suite.add({
  name: 'getExclusiveDurationInMillis flat',

  before: function buildTree() {
    root = new Segment(tx, 'ROOT')
    root.timer.setDurationInMillis(10000, Date.now())
    addChildren(root, 899)
  },
  fn: function() {
    return root.getExclusiveDurationInMillis()
  }
})

suite.add({
  name: 'getExclusiveDurationInMillis linear',

  before: function buildTree() {
    root = new Segment(tx, 'ROOT')
    root.timer.setDurationInMillis(10000, Date.now())
    addChildren(root, 1)
  },
  fn: function() {
    return root.getExclusiveDurationInMillis()
  }
})

suite.add({
  name: 'getExclusiveDurationInMillis binary',

  before: function buildTree() {
    root = new Segment(tx, 'ROOT')
    root.timer.setDurationInMillis(10000, Date.now())
    addChildren(root, 2)
  },
  fn: function() {
    return root.getExclusiveDurationInMillis()
  }
})


suite.run()
