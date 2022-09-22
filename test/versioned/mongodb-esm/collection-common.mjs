/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import common from './common.cjs'
import helper from '../../lib/agent_helper.js'

let METRIC_HOST_NAME = null
let METRIC_HOST_PORT = null

const MONGO_SEGMENT_RE = common.MONGO_SEGMENT_RE
const TRANSACTION_NAME = common.TRANSACTION_NAME
const DB_NAME = common.DB_NAME
const { connect, close, COLLECTIONS } = common

export {
  MONGO_SEGMENT_RE,
  TRANSACTION_NAME,
  DB_NAME,
  connect,
  close,
  populate,
  test,
  dropTestCollections
}

function test({ suiteName, agent, t }, run) {
  t.test(suiteName, { timeout: 10000 }, function (t) {
    let client = null
    let db = null
    let collection = null
    t.autoend()

    t.beforeEach(async function () {
      const { default: mongodb } = await import('mongodb')
      return dropTestCollections(mongodb, COLLECTIONS)
        .then(() => {
          METRIC_HOST_NAME = common.getHostName(agent)
          METRIC_HOST_PORT = common.getPort()
          return common.connect(mongodb)
        })
        .then((res) => {
          client = res.client
          db = res.db
          collection = db.collection(COLLECTIONS[0])
          return populate(db, collection)
        })
    })

    t.afterEach(function () {
      // since we do not bootstrap a new agent between tests
      // metrics will leak across runs if we do not clear
      agent.metrics.clear()
      return common.close(client, db)
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

function populate(db, collection) {
  return new Promise((resolve, reject) => {
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

    db.collection(COLLECTIONS[1]).drop(function () {
      collection.deleteMany({}, function (err) {
        if (err) {
          reject(err)
        }
        collection.insert(items, resolve)
      })
    })
  })
}

/**
 * Bootstrap a running MongoDB instance by dropping all the collections used
 * by tests.
 * @param {*} mongodb MongoDB module to execute commands on.
 * @param {Array} collections Collections to drop for test.
 */
async function dropTestCollections(mongodb, collections) {
  if (!collections.length) {
    return
  }

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
