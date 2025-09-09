/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('#testlib/agent_helper.js')
const benchmark = require('#testlib/benchmark.js')
const Transaction = require('#agentlib/transaction/index.js')

const agent = helper.loadMockedAgent()
const suite = benchmark.createBenchmark({
  name: 'trace segments'
})

let trace
function addChildren(trace, numChildren) {
  const queue = [trace.root]
  for (let numSegments = 1; numSegments < 900; numSegments += numChildren) {
    const parent = queue.shift()
    for (let i = 0; i < numChildren; ++i) {
      const child = trace.add('child ' + (numSegments + i), null, parent)
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
    const transaction = new Transaction(agent)
    trace = transaction.trace
    trace.root.timer.setDurationInMillis(10000, Date.now())
    addChildren(trace, 899)
  },
  fn: function () {
    return trace.toJSON()
  }
})

suite.add({
  name: 'toJSON linear',

  before: function buildTree() {
    const transaction = new Transaction(agent)
    trace = transaction.trace
    trace.root.timer.setDurationInMillis(10000, Date.now())
    addChildren(trace, 1)
  },
  fn: function () {
    return trace.toJSON()
  }
})

suite.add({
  name: 'toJSON binary',

  before: function buildTree() {
    const transaction = new Transaction(agent)
    trace = transaction.trace
    trace.root.timer.setDurationInMillis(10000, Date.now())
    addChildren(trace, 2)
  },
  fn: function () {
    return trace.toJSON()
  }
})

suite.add({
  name: 'getExclusiveDurationInMillis flat',

  before: function buildTree() {
    const transaction = new Transaction(agent)
    trace = transaction.trace
    trace.root.timer.setDurationInMillis(10000, Date.now())
    addChildren(trace, 899)
  },
  fn: function () {
    return trace.getExclusiveDurationInMillis()
  }
})

suite.add({
  name: 'getExclusiveDurationInMillis linear',

  before: function buildTree() {
    const transaction = new Transaction(agent)
    trace = transaction.trace
    trace.root.timer.setDurationInMillis(10000, Date.now())
    addChildren(trace, 1)
  },
  fn: function () {
    return trace.getExclusiveDurationInMillis()
  }
})

suite.add({
  name: 'getExclusiveDurationInMillis binary',

  before: function buildTree() {
    const transaction = new Transaction(agent)
    trace = transaction.trace
    trace.root.timer.setDurationInMillis(10000, Date.now())
    addChildren(trace, 2)
  },
  fn: function () {
    return trace.getExclusiveDurationInMillis()
  }
})

suite.run()
