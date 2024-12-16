/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const common = require('./common')
const helper = require('../../lib/agent_helper')
const mongoPackage = require('mongodb/package.json')

let METRIC_HOST_NAME = null
let METRIC_HOST_PORT = null

exports.connect = common.connect
exports.close = common.close
exports.test = collectionTest
exports.dropTestCollections = dropTestCollections
exports.populate = populate
exports.pkgVersion = mongoPackage.version

const { COLLECTIONS } = common

/**
 * @typedef {object} VerifyCollectionCallbackOptions
 * @property {number} [childrenLength=1] How many children should be present
 * on the root transaction.
 * @property {boolean} [strict=true] Whether or not segments should be tested
 * with strict object equivalence.
 */

/**
 * A function invoked by each subtest after the common assertions have been
 * applied. It is used to assert local assertions for each test.
 *
 * @typedef {function} VerifyCollectionCallback
 * @param {Error|null} error Set if an error occurred prior to the verify
 * function.
 * @param {object[]} [segments] A list of segments from the transaction.
 * @param {object[]} [metrics] A list of metrics collected during the
 * transaction.
 * @param {VerifyCollectionCallbackOptions} [options={}] A set of options
 * that describe how verifications should be performed.
 */

/**
 * Callback to invoke that will issue queries against the provided collection
 * and then invoke a callback to verify the results of those queries.
 *
 * @typedef {function} CollectionTestCallback
 * @param {object} collection The MongoDB collection to issue queries against.
 * @param {VerifyCollectionCallback} verify The callback to invoke that will
 * verify the queries generated the correct data.
 */

/**
 * Runs a series of subtests under a new named parent test.
 *
 * @param {string} name A name to use for the parent test.
 * @param {CollectionTestCallback} run A callback to invoke within each subtest.
 * This callback is useful for asserting local assertions about a given
 * test.
 */
function collectionTest(name, run) {
  test(name, { timeout: 10_000 }, async (t) => {
    await t.test('remote connection', async (t) => {
      t.beforeEach(async (ctx) => {
        ctx.nr = {}
        ctx.nr.agent = helper.instrumentMockedAgent()

        const mongodb = require('mongodb')
        ctx.nr.mongodb = mongodb

        await dropTestCollections(mongodb)
        METRIC_HOST_NAME = common.getHostName(ctx.nr.agent)
        METRIC_HOST_PORT = common.getPort()
        const res = await common.connect({ mongodb })
        ctx.nr.client = res.client
        ctx.nr.db = res.db
        ctx.nr.collection = ctx.nr.db.collection(COLLECTIONS.collection1)
        await populate(ctx.nr.collection)
      })

      t.afterEach(async (ctx) => {
        await common.close(ctx.nr.client, ctx.nr.db)
        helper.unloadAgent(ctx.nr.agent)
        removeModules(['mongodb'])
      })

      await t.test('should not error outside of a transaction', (t, end) => {
        const { agent, collection } = t.nr
        assert.equal(agent.getTransaction(), undefined, 'should not be in a transaction')
        run(collection, function (err) {
          assert.ifError(err, 'running test should not error')
          assert.equal(agent.getTransaction(), undefined, 'should not somehow gain a transaction')
          end()
        })
      })

      await t.test('should generate the correct metrics and segments', (t, end) => {
        const { agent, collection } = t.nr
        helper.runInTransaction(agent, function (transaction) {
          transaction.name = common.TRANSACTION_NAME
          run(
            collection,
            function (err, segments, metrics, { childrenLength = 1, strict = true } = {}) {
              assert.ifError(err, 'running test should not error')
              assert.ok(agent.getTransaction(), 'should maintain tx state')

              assert.equal(
                agent.getTransaction().id,
                transaction.id,
                'should not change transactions'
              )
              const segment = agent.tracer.getSegment()
              let current = transaction.trace.root

              // this logic is just for the collection.aggregate.
              // aggregate no longer returns a callback with cursor
              // it just returns a cursor. so the segments on the
              // transaction are not nested but both on the trace
              // root. instead of traversing the children, just
              // iterate over the expected segments and compare
              // against the corresponding child on trace root
              // we also added a strict flag for aggregate because depending on the version
              // there is an extra segment for the callback of our test which we do not care
              // to assert
              if (childrenLength === 2) {
                assert.equal(current.children.length, childrenLength, 'should have one child')

                segments.forEach((expectedSegment, i) => {
                  const child = current.children[i]

                  assert.equal(
                    child.name,
                    expectedSegment,
                    `child should be named ${expectedSegment}`
                  )
                  if (common.MONGO_SEGMENT_RE.test(child.name)) {
                    checkSegmentParams(child)
                    assert.equal(child.ignore, false, 'should not ignore segment')
                  }

                  if (strict) {
                    assert.equal(child.children.length, 0, 'should have no more children')
                  }
                })
              } else {
                for (let i = 0, l = segments.length; i < l; ++i) {
                  assert.equal(current.children.length, childrenLength, 'should have one child')
                  current = current.children[0]
                  assert.equal(current.name, segments[i], 'child should be named ' + segments[i])
                  if (common.MONGO_SEGMENT_RE.test(current.name)) {
                    checkSegmentParams(current)
                    assert.equal(current.ignore, false, 'should not ignore segment')
                  }
                }

                if (strict) {
                  assert.equal(current.children.length, 0, 'should have no more children')
                }
              }

              if (strict) {
                assert.ok(current === segment, 'should test to the current segment')
              }

              transaction.end()
              common.checkMetrics({
                agent,
                host: METRIC_HOST_NAME,
                port: METRIC_HOST_PORT,
                metrics
              })
              end()
            }
          )
        })
      })

      await t.test('should respect `datastore_tracer.instance_reporting`', (t, end) => {
        const { agent, collection } = t.nr
        agent.config.datastore_tracer.instance_reporting.enabled = false
        helper.runInTransaction(agent, function (tx) {
          run(collection, function (err) {
            assert.ifError(err, 'running test should not error')

            let current = tx.trace.root
            while (current) {
              if (common.MONGO_SEGMENT_RE.test(current.name)) {
                const attributes = current.getAttributes()
                assert.equal(attributes.host, undefined, 'should not have host attribute')
                assert.equal(
                  attributes.port_path_or_id,
                  undefined,
                  'should not have port attribute'
                )
                assert.ok(attributes.database_name, 'should have database name attribute')
                assert.ok(attributes.product, 'should have product attribute')
              }
              current = current.children[0]
            }
            end()
          })
        })
      })

      await t.test('should respect `datastore_tracer.database_name_reporting`', (t, end) => {
        const { agent, collection } = t.nr
        agent.config.datastore_tracer.database_name_reporting.enabled = false
        helper.runInTransaction(agent, function (tx) {
          run(collection, function (err) {
            assert.ifError(err, 'running test should not error')

            let current = tx.trace.root
            while (current) {
              if (common.MONGO_SEGMENT_RE.test(current.name)) {
                const attributes = current.getAttributes()
                assert.ok(attributes.host, 'should have host attribute')
                assert.ok(attributes.port_path_or_id, 'should have port attribute')
                assert.equal(
                  attributes.database_name,
                  undefined,
                  'should not have database name attribute'
                )
                assert.ok(attributes.product, 'should have product attribute')
              }
              current = current.children[0]
            }
            end()
          })
        })
      })
    })

    await t.test('replica set string remote connection', async (t) => {
      t.beforeEach(async (ctx) => {
        ctx.nr = {}
        ctx.nr.agent = helper.instrumentMockedAgent()

        const mongodb = require('mongodb')
        ctx.nr.mongodb = mongodb

        await dropTestCollections(mongodb)
        METRIC_HOST_NAME = common.getHostName(ctx.nr.agent)
        METRIC_HOST_PORT = common.getPort()
        const res = await common.connect({ mongodb })
        ctx.nr.client = res.client
        ctx.nr.db = res.db
        ctx.nr.collection = ctx.nr.db.collection(COLLECTIONS.collection1)
        await populate(ctx.nr.collection)
      })

      t.afterEach(async (ctx) => {
        await common.close(ctx.nr.client, ctx.nr.db)
        helper.unloadAgent(ctx.nr.agent)
        removeModules(['mongodb'])
      })

      await t.test('should generate the correct metrics and segments', (t, end) => {
        const { agent, collection } = t.nr
        helper.runInTransaction(agent, function (transaction) {
          transaction.name = common.TRANSACTION_NAME
          run(
            collection,
            function (err, segments, metrics, { childrenLength = 1, strict = true } = {}) {
              assert.ifError(err, 'running test should not error')
              assert.ok(agent.getTransaction(), 'should maintain tx state')

              assert.equal(
                agent.getTransaction().id,
                transaction.id,
                'should not change transactions'
              )
              const segment = agent.tracer.getSegment()
              let current = transaction.trace.root

              // this logic is just for the collection.aggregate.
              // aggregate no longer returns a callback with cursor
              // it just returns a cursor. so the segments on the
              // transaction are not nested but both on the trace
              // root. instead of traversing the children, just
              // iterate over the expected segments and compare
              // against the corresponding child on trace root
              // we also added a strict flag for aggregate because depending on the version
              // there is an extra segment for the callback of our test which we do not care
              // to assert
              if (childrenLength === 2) {
                assert.equal(current.children.length, childrenLength, 'should have one child')

                segments.forEach((expectedSegment, i) => {
                  const child = current.children[i]

                  assert.equal(
                    child.name,
                    expectedSegment,
                    `child should be named ${expectedSegment}`
                  )
                  if (common.MONGO_SEGMENT_RE.test(child.name)) {
                    checkSegmentParams(child)
                    assert.equal(child.ignore, false, 'should not ignore segment')
                  }

                  if (strict) {
                    assert.equal(child.children.length, 0, 'should have no more children')
                  }
                })
              } else {
                for (let i = 0, l = segments.length; i < l; ++i) {
                  assert.equal(current.children.length, childrenLength, 'should have one child')
                  current = current.children[0]
                  assert.equal(current.name, segments[i], 'child should be named ' + segments[i])
                  if (common.MONGO_SEGMENT_RE.test(current.name)) {
                    checkSegmentParams(current)
                    assert.equal(current.ignore, false, 'should not ignore segment')
                  }
                }

                if (strict) {
                  assert.equal(current.children.length, 0, 'should have no more children')
                }
              }

              if (strict) {
                assert.ok(current === segment, 'should test to the current segment')
              }

              transaction.end()
              common.checkMetrics({
                agent,
                host: METRIC_HOST_NAME,
                port: METRIC_HOST_PORT,
                metrics
              })
              end()
            }
          )
        })
      })
    })
  })
}

function checkSegmentParams(segment) {
  let dbName = common.DB_NAME
  if (/\/rename$/.test(segment.name)) {
    dbName = 'admin'
  }

  const attributes = segment.getAttributes()
  assert.equal(attributes.database_name, dbName, 'should have correct db name')
  assert.equal(attributes.host, METRIC_HOST_NAME, 'should have correct host name')
  assert.equal(attributes.port_path_or_id, METRIC_HOST_PORT, 'should have correct port')
}

async function populate(collection) {
  const items = []
  for (let i = 0; i < 30; ++i) {
    items.push({
      i: i,
      next3: [i + 1, i + 2, i + 3],
      data: Math.random().toString(36).slice(2),
      mod10: i % 10,
      // spiral out
      loc: [i % 4 && (i + 1) % 4 ? i : -i, (i + 1) % 4 && (i + 2) % 4 ? i : -i]
    })
  }

  await collection.insertMany(items)
}

/**
 * Bootstrap a running MongoDB instance by dropping all the collections used
 * by tests.
 * @param {*} mongodb MongoDB module to execute commands on.
 */
async function dropTestCollections(mongodb) {
  const collections = Object.values(COLLECTIONS)
  const { client, db } = await common.connect({ mongodb })

  const dropCollectionPromises = collections.map(async (collection) => {
    try {
      await db.dropCollection(collection)
    } catch (err) {
      if (err && err.errmsg !== 'ns not found') {
        throw err
      }
    }
  })

  try {
    await Promise.all(dropCollectionPromises)
  } finally {
    await common.close(client, db)
  }
}
