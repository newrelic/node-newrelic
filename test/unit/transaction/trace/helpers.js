/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const util = require('node:util')
const codec = require('../../../../lib/util/codec')
const codecEncodeAsync = util.promisify(codec.encode)
const Transaction = require('../../../../lib/transaction')

function addTwoSegments(transaction) {
  const trace = transaction.trace
  const child1 = addBaseSegment({ transaction, name: 'test' })
  const child2 = addSegment({ trace, name: 'span', child: child1 })
  child1.end()
  child2.end()
  trace.root.end()
}

async function makeTrace(agent) {
  const DURATION = 33
  const url = '/test'
  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  const transaction = new Transaction(agent)
  transaction.url = url
  transaction.verb = 'GET'

  const trace = transaction.trace

  // promisifying `trace.generateJSON` so tests do not have to call done
  // and instead use async/await
  trace.generateJSONAsync = util.promisify(trace.generateJSON)
  const start = trace.root.timer.start
  if (start < 0) {
    throw new Error('root segment start time is not >0')
  }
  trace.setDurationInMillis(DURATION, 0)

  const web = trace.add(URL)
  transaction.baseSegment = web
  transaction.addRequestParameters({ test: 'value' })
  transaction.finalizeNameFromWeb(200)
  // top-level element will share a duration with the quasi-ROOT node
  web.setDurationInMillis(DURATION, 0)

  const db = trace.add('Database/statement/AntiSQL/select/getSome', null, web)
  db.setDurationInMillis(14, 3)

  const memcache = trace.add('Datastore/operation/Memcache/lookup', null, web)
  memcache.setDurationInMillis(20, 8)

  transaction.timer.setDurationInMillis(DURATION)
  trace.end()

  /*
   * Segment data repeats the outermost data, span, with the scope for the
   * outermost version having its scope always set to 'ROOT'. The null bits
   * are parameters, which are optional, and so far, unimplemented for Node.
   */
  const dbSegment = [
    3,
    17,
    'Database/statement/AntiSQL/select/getSome',
    { nr_exclusive_duration_millis: 14 },
    []
  ]
  const memcacheSegment = [
    8,
    28,
    'Datastore/operation/Memcache/lookup',
    { nr_exclusive_duration_millis: 20 },
    []
  ]

  const rootSegment = [
    0,
    DURATION,
    'ROOT',
    { nr_exclusive_duration_millis: 0 },
    [
      [
        0,
        DURATION,
        'WebTransaction/NormalizedUri/*',
        {
          'request.parameters.test': 'value',
          nr_exclusive_duration_millis: 8
        },
        [dbSegment, memcacheSegment]
      ]
    ]
  ]
  const rootNode = [
    trace.root.timer.start / 1000,
    {},
    { nr_flatten_leading: false },
    rootSegment,
    {
      agentAttributes: {
        'request.parameters.test': 'value'
      },
      userAttributes: {},
      intrinsics: {}
    },
    [] // FIXME: parameter groups
  ]

  const encoded = await codecEncodeAsync(rootNode)
  return {
    transaction,
    trace,
    rootNode,
    expectedEncoding: [
      0,
      DURATION,
      'WebTransaction/NormalizedUri/*', // scope
      '/test', // URI path
      encoded, // compressed segment / segment data
      transaction.id, // guid
      null, // reserved, always NULL
      false, // FIXME: RUM2 session persistence, not worrying about it for now
      null, // FIXME: xraysessionid
      null // syntheticsResourceId
    ]
  }
}

function addSegment({ trace, name, child, attributes }) {
  const segment = trace.add(name, null, child)
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      segment.addAttribute(key, value)
    }
  }
  segment.start()
  return segment
}

function addBaseSegment({ transaction, name }) {
  const segment = addSegment({ trace: transaction.trace, name })
  transaction.baseSegment = segment
  return segment
}

function assertSpan({ span, transaction, name, isEntry, parentId, category, attributes = {} }, { assert = require('node:assert') } = {}) {
  assert.ok(span.intrinsics)
  assert.ok(span.intrinsics.category)
  assert.equal(span.intrinsics.category, category)
  assert.ok(span.intrinsics.priority)
  assert.equal(span.intrinsics.priority, transaction.priority)
  assert.ok(span.intrinsics.transactionId)
  assert.equal(span.intrinsics.transactionId, transaction.id)
  assert.ok(span.intrinsics.sampled)
  assert.equal(span.intrinsics.sampled, transaction.sampled)
  assert.ok(span.intrinsics.name)
  assert.equal(span.intrinsics.name, name)
  assert.ok(span.intrinsics.traceId)
  assert.equal(span.intrinsics.traceId, transaction.traceId)
  assert.ok(span.intrinsics.timestamp)
  if (isEntry) {
    assert.ok(span.intrinsics['nr.entryPoint'])
    assert.ok(!span.intrinsics.parentId)
  } else {
    assert.ok(span.intrinsics.parentId)
    assert.equal(span.intrinsics.parentId, parentId)
    assert.ok(!span.intrinsics['nr.entryPoint'])
  }

  for (const [key, value] of Object.entries(attributes)) {
    assert.equal(span.attributes[key], value)
  }
}

function setupPartialTrace({ agent, type, randomizeErrorAttrs, attributes = { foo: 'bar', host: 'unit-test' } }) {
  agent.config.span_events.enabled = true
  agent.config.distributed_tracing.enabled = true
  agent.samplers.fullEnabled = false
  agent.samplers.partialEnabled = true
  agent.samplers.partialType = type

  const transaction = new Transaction(agent)

  const trace = transaction.trace
  const child1 = addBaseSegment({ transaction, name: 'test' })
  const child2 = addSegment({ trace, name: 'nested', child: child1 })
  const child3 = addSegment({ trace, name: 'Datastore/operation/Redis/GET', child: child2, attributes })
  const child4 = addSegment({ trace, name: 'nested1', child: child3 })
  const child5 = addSegment({ trace, name: 'nested2', child: child4 })
  if (randomizeErrorAttrs) {
    attributes['error.class'] = 'FinalClass'
    attributes['error.message'] = 'This should be the one'
    attributes['error.expected'] = false
  }
  const child6 = addSegment({ trace, name: 'Datastore/operation/Redis/SET', child: child5, attributes })
  // add 10ms to last child so it ensures it takes the last error
  child6.timer.start += 10
  child1.end()
  child2.end()
  child3.end()
  child4.end()
  child5.end()
  child6.end()
  trace.root.end()
  transaction.end()
  return transaction
}

module.exports = {
  assertSpan,
  addBaseSegment,
  addSegment,
  addTwoSegments,
  makeTrace,
  setupPartialTrace
}
