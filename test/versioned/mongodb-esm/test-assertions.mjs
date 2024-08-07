/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert'
import common from '../mongodb/common.js'

const TRANSACTION_NAME = 'mongo test'
const { DB_NAME, STATEMENT_PREFIX } = common.ESM

export { getValidatorCallback, matchObject }

function getValidatorCallback({ t, tx, segments, metrics, end, childrenLength = 1 }) {
  const { agent, METRIC_HOST_NAME, METRIC_HOST_PORT } = t.nr
  return function done(error) {
    assert.equal(error, undefined)
    assert.equal(agent.getTransaction().id, tx.id, 'should not change transactions')

    const segment = agent.tracer.getSegment()
    let current = tx.trace.root

    if (childrenLength === 2) {
      // This block is for testing `collection.aggregate`. The `aggregate`
      // method does not return a callback with a cursor, it only returns a
      // cursor. So the segments on the transaction are not nested. They are
      // both on the trace root. Instead of traversing the children, we iterate
      // over the expected segments and compare against the corresponding child
      // on the trace root. We also added a strict flag for `aggregate` because,
      // depending on the version, there is an extra segment for the callback
      // of our test which we do not need to assert.
      assert.equal(current.children.length, childrenLength, 'should have two children')
      for (const [i, expectedSegment] of segments.entries()) {
        const child = current.children[i]
        assert.equal(child.name, expectedSegment, `child should be named ${expectedSegment}`)
        if (common.MONGO_SEGMENT_RE.test(child.name) === true) {
          checkSegmentParams(child, METRIC_HOST_NAME, METRIC_HOST_PORT)
          assert.equal(child.ignore, false, 'should not ignore segment')
        }
        assert.equal(child.children.length, 0, 'should have no more children')
      }
    } else {
      for (let i = 0, l = segments.length; i < l; ++i) {
        assert.equal(current.children.length, 1, 'should have one child')
        current = current.children[0]
        assert.equal(current.name, segments[i], 'child should be named ' + segments[i])
        if (common.MONGO_SEGMENT_RE.test(current.name) === true) {
          checkSegmentParams(current, METRIC_HOST_NAME, METRIC_HOST_PORT)
          assert.equal(current.ignore, false, 'should not ignore segment')
        }
      }
      assert.equal(current.children.length, 0, 'should have no more children')
    }
    assert.equal(current === segment, true, 'should test to the current segment')

    tx.end()
    checkMetrics({
      t,
      agent,
      host: METRIC_HOST_NAME,
      port: METRIC_HOST_PORT,
      metrics,
      prefix: STATEMENT_PREFIX
    })

    end()
  }
}

function checkSegmentParams(segment, host, port) {
  let dbName = DB_NAME
  if (/\/rename$/.test(segment.name) === true) {
    dbName = 'admin'
  }

  const attributes = segment.getAttributes()
  assert.equal(attributes.database_name, dbName, 'should have correct db name')
  assert.equal(attributes.host, host, 'should have correct host name')
  assert.equal(attributes.port_path_or_id, port, 'should have correct port')
}

function checkMetrics({ agent, host, port, metrics = [], prefix = STATEMENT_PREFIX }) {
  const agentMetrics = agent.metrics._metrics
  const unscopedMetrics = agentMetrics.unscoped
  const unscopedDatastoreNames = Object.keys(unscopedMetrics).filter((k) => k.includes('Datastore'))
  const scoped = agentMetrics.scoped[TRANSACTION_NAME]
  let total = 0

  assert.notEqual(scoped, undefined, 'should have scoped metrics')
  assert.equal(Object.keys(agentMetrics.scoped).length, 1, 'should have one metric scope')
  for (let i = 0; i < metrics.length; ++i) {
    let count = null
    let name = null

    if (Array.isArray(metrics[i]) === true) {
      count = metrics[i][1]
      name = metrics[i][0]
    } else {
      count = 1
      name = metrics[i]
    }
    total += count

    assert.equal(
      unscopedMetrics['Datastore/operation/MongoDB/' + name].callCount,
      count,
      `unscoped operation metrics should be called ${count} times`
    )
    assert.equal(
      unscopedMetrics[`${prefix}/${name}`].callCount,
      count,
      `unscoped statement metric should be called ${count} times`
    )
    assert.equal(
      scoped[`${prefix}/${name}`].callCount,
      count,
      `scoped statement metrics should be called ${count} times`
    )
  }

  let expectedUnscopedCount = 5 + 2 * metrics.length
  if (agent.config.security.agent.enabled === true) {
    // The security agent adds a `Supportability/API/instrumentDatastore` metric
    // via `API.prototype.instrumentDatastore`.
    expectedUnscopedCount += 1
  }
  assert.equal(
    unscopedDatastoreNames.length,
    expectedUnscopedCount,
    `should have ${expectedUnscopedCount} unscoped metrics`
  )

  const expectedUnscopedMetrics = [
    'Datastore/all',
    'Datastore/allWeb',
    'Datastore/MongoDB/all',
    'Datastore/MongoDB/allWeb',
    'Datastore/instance/MongoDB/' + host + '/' + port
  ]
  for (const metric of expectedUnscopedMetrics) {
    assert.notEqual(unscopedMetrics[metric], undefined, `should have unscoped metric ${metric}`)
    assert.equal(unscopedMetrics[metric].callCount, total, 'should have correct call count')
  }
}

function matchObject(obj, expected) {
  for (const key of Object.keys(expected)) {
    if (Object.prototype.toString.call(obj[key]) === '[object Object]') {
      matchObject(obj[key], expected[key])
      continue
    }
    if (Array.isArray(obj[key]) === true) {
      // Do a simple element count check until we need something deeper.
      assert.equal(
        obj[key].length,
        expected[key].length,
        `array ${key} should have same number of elements`
      )
      continue
    }
    assert.equal(obj[key], expected[key], `${key} should equal ${expected[key]}`)
  }
}
