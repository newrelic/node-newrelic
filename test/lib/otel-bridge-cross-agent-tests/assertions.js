/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const parameters = require('./parameters')

function notValid(agent, param, description) {
  const fn = parameters[param.object]
  const result = fn(agent)
  assert.ok(!result, description)
}

function equals(agent, param, description) {
  const [leftFn, leftProp] = param.left.split('.')
  const [rightFn, rightProp] = param.right.split('.')
  const left = parameters[leftFn](agent)
  const right = parameters[rightFn](agent)
  assert.equal(left[leftProp], right[rightProp], description)
}

function matches(agent, param, description) {
  const [fn, prop] = param.object.split('.')
  const data = parameters[fn](agent)
  assert.equal(data[prop], param.value, description)
}

function agentOutput(agent, output) {
  const txData = agent.transactionEventAggregator.getEvents()
  assert.equal(txData.length, output.transactions.length)
  output.transactions.forEach(({ name }) => {
    const foundTx = txData.find((tx) => tx[0].name === name)
    assert.ok(foundTx, `could not find ${name}`)
  })

  const spans = agent.spanEventAggregator.getEvents()
  output.spans.forEach((span, i) => {
    const spanFromAgent = spans.find((s) => s.intrinsics.name === span.name)
    assert.ok(spanFromAgent)
    if (span.category) {
      assert.equal(spanFromAgent.intrinsics.category, span.category)
    }

    if (span.entryPoint) {
      assert.equal(spanFromAgent.intrinsics['nr.entryPoint'], true)
    }

    if (span.attributes) {
      for (const attr in span.attributes) {
        assert.equal(spanFromAgent.attributes[attr], span.attributes[attr])
      }
    }

    if (span.parentName) {
      const parent = spans.find((s) => {
        return s.intrinsics.name.endsWith(span.parentName)
      })
      assert.equal(spanFromAgent.intrinsics.parentId, parent.intrinsics.guid)
    }
  })
}

module.exports = {
  agentOutput,
  equals,
  matches,
  notValid
}
