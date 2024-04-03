/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./common')
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const semver = require('semver')
const { version: pkgVersion } = require('mongodb/package')

let METRIC_HOST_NAME = null
let METRIC_HOST_PORT = null

exports.connect = common.connect
exports.close = common.close
exports.test = collectionTest
exports.dropTestCollections = dropTestCollections
exports.populate = populate

const { COLLECTIONS } = common

function collectionTest(name, run) {
  tap.test(name, { timeout: 10000 }, function (t) {
    let agent = null
    let client = null
    let db = null
    let collection = null
    t.autoend()

    t.test('remote connection', function (t) {
      t.autoend()
      t.beforeEach(async function () {
        agent = helper.instrumentMockedAgent()

        const mongodb = require('mongodb')

        await dropTestCollections(mongodb)
        METRIC_HOST_NAME = common.getHostName(agent)
        METRIC_HOST_PORT = common.getPort()
        const res = await common.connect(mongodb)
        client = res.client
        db = res.db
        collection = db.collection(COLLECTIONS.collection1)
        await populate(collection)
      })

      t.afterEach(async function () {
        await common.close(client, db)
        helper.unloadAgent(agent)
        agent = null
      })

      t.test('should not error outside of a transaction', function (t) {
        t.notOk(agent.getTransaction(), 'should not be in a transaction')
        run(t, collection, function (err) {
          t.error(err, 'running test should not error')
          t.notOk(agent.getTransaction(), 'should not somehow gain a transaction')
          t.end()
        })
      })

      t.test('should generate the correct metrics and segments', function (t) {
        helper.runInTransaction(agent, function (transaction) {
          transaction.name = common.TRANSACTION_NAME
          run(
            t,
            collection,
            function (err, segments, metrics, { childrenLength = 1, strict = true } = {}) {
              if (
                !t.error(err, 'running test should not error') ||
                !t.ok(agent.getTransaction(), 'should maintain tx state')
              ) {
                return t.end()
              }
              t.equal(agent.getTransaction().id, transaction.id, 'should not change transactions')
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
                t.equal(current.children.length, childrenLength, 'should have one child')

                segments.forEach((expectedSegment, i) => {
                  const child = current.children[i]

                  t.equal(child.name, expectedSegment, `child should be named ${expectedSegment}`)
                  if (common.MONGO_SEGMENT_RE.test(child.name)) {
                    checkSegmentParams(t, child)
                    t.equal(child.ignore, false, 'should not ignore segment')
                  }

                  if (strict) {
                    t.equal(child.children.length, 0, 'should have no more children')
                  }
                })
              } else {
                for (let i = 0, l = segments.length; i < l; ++i) {
                  t.equal(current.children.length, childrenLength, 'should have one child')
                  current = current.children[0]
                  t.equal(current.name, segments[i], 'child should be named ' + segments[i])
                  if (common.MONGO_SEGMENT_RE.test(current.name)) {
                    checkSegmentParams(t, current)
                    t.equal(current.ignore, false, 'should not ignore segment')
                  }
                }

                if (strict) {
                  t.equal(current.children.length, 0, 'should have no more children')
                }
              }

              if (strict) {
                t.ok(current === segment, 'should test to the current segment')
              }

              transaction.end()
              common.checkMetrics(t, agent, METRIC_HOST_NAME, METRIC_HOST_PORT, metrics || [])
              t.end()
            }
          )
        })
      })

      t.test('should respect `datastore_tracer.instance_reporting`', function (t) {
        agent.config.datastore_tracer.instance_reporting.enabled = false
        helper.runInTransaction(agent, function (tx) {
          run(t, collection, function (err) {
            if (!t.error(err, 'running test should not error')) {
              return t.end()
            }

            let current = tx.trace.root
            while (current) {
              if (common.MONGO_SEGMENT_RE.test(current.name)) {
                t.comment('Checking segment ' + current.name)
                const attributes = current.getAttributes()
                t.notOk(attributes.host, 'should not have host attribute')
                t.notOk(attributes.port_path_or_id, 'should not have port attribute')
                t.ok(attributes.database_name, 'should have database name attribute')
                t.ok(attributes.product, 'should have product attribute')
              }
              current = current.children[0]
            }
            t.end()
          })
        })
      })

      t.test('should respect `datastore_tracer.database_name_reporting`', function (t) {
        agent.config.datastore_tracer.database_name_reporting.enabled = false
        helper.runInTransaction(agent, function (tx) {
          run(t, collection, function (err) {
            if (!t.error(err, 'running test should not error')) {
              return t.end()
            }

            let current = tx.trace.root
            while (current) {
              if (common.MONGO_SEGMENT_RE.test(current.name)) {
                t.comment('Checking segment ' + current.name)
                const attributes = current.getAttributes()
                t.ok(attributes.host, 'should have host attribute')
                t.ok(attributes.port_path_or_id, 'should have port attribute')
                t.notOk(attributes.database_name, 'should not have database name attribute')
                t.ok(attributes.product, 'should have product attribute')
              }
              current = current.children[0]
            }
            t.end()
          })
        })
      })
    })

    // this seems to break in 3.x up to 3.6.0
    // I think it is because of this https://jira.mongodb.org/browse/NODE-2452
    if (semver.satisfies(pkgVersion, '>=3.6.0')) {
      t.test('replica set string remote connection', function (t) {
        t.autoend()
        t.beforeEach(async function () {
          agent = helper.instrumentMockedAgent()

          const mongodb = require('mongodb')

          await dropTestCollections(mongodb)
          METRIC_HOST_NAME = common.getHostName(agent)
          METRIC_HOST_PORT = common.getPort()
          const res = await common.connect(mongodb, null, true)
          client = res.client
          db = res.db
          collection = db.collection(COLLECTIONS.collection1)
          await populate(collection)
        })

        t.afterEach(async function () {
          await common.close(client, db)
          helper.unloadAgent(agent)
          agent = null
        })

        t.test('should generate the correct metrics and segments', function (t) {
          helper.runInTransaction(agent, function (transaction) {
            transaction.name = common.TRANSACTION_NAME
            run(
              t,
              collection,
              function (err, segments, metrics, { childrenLength = 1, strict = true } = {}) {
                if (
                  !t.error(err, 'running test should not error') ||
                  !t.ok(agent.getTransaction(), 'should maintain tx state')
                ) {
                  return t.end()
                }
                t.equal(agent.getTransaction().id, transaction.id, 'should not change transactions')
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
                  t.equal(current.children.length, childrenLength, 'should have one child')

                  segments.forEach((expectedSegment, i) => {
                    const child = current.children[i]

                    t.equal(child.name, expectedSegment, `child should be named ${expectedSegment}`)
                    if (common.MONGO_SEGMENT_RE.test(child.name)) {
                      checkSegmentParams(t, child)
                      t.equal(child.ignore, false, 'should not ignore segment')
                    }

                    if (strict) {
                      t.equal(child.children.length, 0, 'should have no more children')
                    }
                  })
                } else {
                  for (let i = 0, l = segments.length; i < l; ++i) {
                    t.equal(current.children.length, childrenLength, 'should have one child')
                    current = current.children[0]
                    t.equal(current.name, segments[i], 'child should be named ' + segments[i])
                    if (common.MONGO_SEGMENT_RE.test(current.name)) {
                      checkSegmentParams(t, current)
                      t.equal(current.ignore, false, 'should not ignore segment')
                    }
                  }

                  if (strict) {
                    t.equal(current.children.length, 0, 'should have no more children')
                  }
                }

                if (strict) {
                  t.ok(current === segment, 'should test to the current segment')
                }

                transaction.end()
                common.checkMetrics(t, agent, METRIC_HOST_NAME, METRIC_HOST_PORT, metrics || [])
                t.end()
              }
            )
          })
        })
      })
    }
  })
}

function checkSegmentParams(t, segment) {
  let dbName = common.DB_NAME
  if (/\/rename$/.test(segment.name)) {
    dbName = 'admin'
  }

  const attributes = segment.getAttributes()
  t.equal(attributes.database_name, dbName, 'should have correct db name')
  t.equal(attributes.host, METRIC_HOST_NAME, 'should have correct host name')
  t.equal(attributes.port_path_or_id, METRIC_HOST_PORT, 'should have correct port')
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
  const { client, db } = await common.connect(mongodb)

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
