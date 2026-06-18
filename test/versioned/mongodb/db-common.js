/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const common = require('./common')
const collectionCommon = require('./collection-common')
const helper = require('../../lib/agent_helper')
const { assertPackageMetrics } = require('../../lib/custom-assertions')

let MONGO_HOST = null
let MONGO_PORT = null
const BAD_MONGO_COMMANDS = ['collection']

/**
 * Very similar to the test runner in `./collection-common.js`. Refer to the
 * docblocks there for clarification.
 *
 * @param {string} name Parent test name.
 * @param {Function} run Provided a db instance and a verify callback.
 */
function dbTest(name, run) {
  test(name, async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent()

      const mongodb = require('mongodb')
      ctx.nr.mongodb = mongodb

      await collectionCommon.dropTestCollections(mongodb)
      MONGO_HOST = common.getHostName(ctx.nr.agent)
      MONGO_PORT = common.getPort()

      const res = await common.connect({ mongodb })
      ctx.nr.client = res.client
      ctx.nr.db = res.db
    })

    t.afterEach(async (ctx) => {
      await common.close(ctx.nr.client, ctx.nr.db)
      helper.unloadAgent(ctx.nr.agent)
      removeModules(['mongodb'])
    })

    await t.test('should log tracking metrics', function(t) {
      const { agent } = t.nr
      const { version } = require('mongodb/package.json')
      assertPackageMetrics({ agent, pkg: 'mongodb', version, subscriberType: true })
    })

    await t.test('without transaction', (t, end) => {
      const { agent, db } = t.nr
      run(db, function () {
        assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
        end()
      })
    })

    await t.test('with transaction', (t, end) => {
      const { agent, db } = t.nr
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      helper.runInTransaction(agent, async function (transaction) {
        transaction.name = common.TRANSACTION_NAME
        await run(db, function (segments, metrics, opts = {}) {
          // Verify segments before ending transaction
          verifyMongoSegments(agent, transaction, segments, opts)
          // End transaction to finalize metrics
          transaction.end()
          // Verify metrics after ending transaction
          verifyMongoMetrics(agent, metrics)
          end()
        })
      })
    })
  })
}

function verifyMongoSegments(agent, transaction, segments, opts = {}) {
  assert.ok(agent.getTransaction(), 'should not lose transaction state')
  assert.equal(agent.getTransaction().id, transaction.id, 'transaction is correct')

  const rootSegment = transaction.trace.root

  // Get all direct children of root (DB operations are flat, not nested)
  let children = transaction.trace.getChildren(rootSegment.id)
  if (opts.legacy) {
    // Filter out net.createConnection segments as they could occur during execution, which is fine
    // but breaks our assertion function.
    children = children.filter((c) => c.name !== 'net.createConnection')
  }

  // Verify we have the right number of segments
  assert.equal(children.length, segments.length, `should have ${segments.length} child segment(s)`)

  // Verify each segment
  for (let i = 0; i < segments.length; i++) {
    const child = children[i]
    assert.equal(child.name, segments[i], 'segment should be named ' + segments[i])

    // If checkNoChildren is set, verify this segment has no children (opaque behavior)
    if (opts.checkNoChildren) {
      const childSegments = transaction.trace.getChildren(child.id)
      assert.equal(
        childSegments.length,
        0,
        `segment ${child.name} should have no children (opaque should be true)`
      )
    }

    // If this is a Mongo operation/statement segment then it should have the
    // datastore instance attributes.
    if (/^Datastore\/.*?\/MongoDB/.test(child.name)) {
      if (isBadSegment(child)) {
        continue
      }

      // Commands known as "admin commands" always happen against the "admin"
      // database regardless of the DB the connection is actually connected to.
      // This is apparently by design.
      // https://jira.mongodb.org/browse/NODE-827
      let dbName = common.DB_NAME
      if (/\/renameCollection$/.test(child.name)) {
        dbName = 'admin'
      }

      const attributes = child.getAttributes()
      assert.equal(attributes.database_name, dbName, 'should have correct db name')
      assert.equal(attributes.host, MONGO_HOST, 'should have correct host name')
      assert.equal(attributes.port_path_or_id, MONGO_PORT, 'should have correct port')
      assert.equal(attributes.product, 'MongoDB', 'should have correct product attribute')
    }
  }
}

function verifyMongoMetrics(agent, metrics) {
  const agentMetrics = agent.metrics._metrics
  const unscopedMetrics = agentMetrics.unscoped
  const scopedMetrics = agentMetrics.scoped[common.TRANSACTION_NAME]

  assert.ok(scopedMetrics, 'should have scoped metrics')

  let totalOperations = 0
  for (const metricName of metrics) {
    totalOperations += 1
    const fullMetricName = `Datastore/operation/MongoDB/${metricName}`

    // Verify unscoped operation metric
    assert.ok(unscopedMetrics[fullMetricName], `should have unscoped metric ${fullMetricName}`)
    assert.ok(
      unscopedMetrics[fullMetricName].callCount > 0,
      `metric ${fullMetricName} should have been called`
    )

    // Verify scoped operation metric
    assert.ok(scopedMetrics[fullMetricName], `should have scoped metric ${fullMetricName}`)
    assert.ok(
      scopedMetrics[fullMetricName].callCount > 0,
      `scoped metric ${fullMetricName} should have been called`
    )
  }

  // Verify rollup metrics created by database recorder
  const expectedRollupMetrics = [
    'Datastore/all',
    'Datastore/allWeb',
    'Datastore/MongoDB/all',
    'Datastore/MongoDB/allWeb',
    `Datastore/instance/MongoDB/${MONGO_HOST}/${MONGO_PORT}`
  ]

  for (const metric of expectedRollupMetrics) {
    assert.ok(unscopedMetrics[metric], `should have rollup metric ${metric}`)
    assert.equal(
      unscopedMetrics[metric].callCount,
      totalOperations,
      `rollup metric ${metric} should have correct call count`
    )
  }
}

function isBadSegment(segment) {
  const nameParts = segment.name.split('/')
  const command = nameParts[nameParts.length - 1]
  const attributes = segment.getAttributes()

  return (
    BAD_MONGO_COMMANDS.indexOf(command) !== -1 && // Is in the list of bad commands
    !attributes.database_name && // and does not have any of the
    !attributes.host && // instance attributes.
    !attributes.port_path_or_id
  )
}

module.exports = {
  dbTest
}
