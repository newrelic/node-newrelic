/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import { createRequire } from 'node:module'

import helper from '../../lib/agent_helper.js'
import common from '../mongodb/common.js'

const require = createRequire(import.meta.url)
const mongoPackage = require('mongodb/package.json')

const { COLLECTIONS } = common.ESM
const DB_NAME = common.ESM.DB_NAME
const STATEMENT_PREFIX = common.ESM.STATEMENT_PREFIX

let METRIC_HOST_NAME = null
let METRIC_HOST_PORT = null

const pkgVersion = mongoPackage.version

export {
  collectionTest,
  dropTestCollections,
  populate,
  pkgVersion
}

function collectionTest(name, run) {
  test(name, { timeout: 10_000 }, async (t) => {
    await t.test('remote connection', async (t) => {
      t.beforeEach(async (ctx) => {
        ctx.nr = {}
        ctx.nr.agent = helper.instrumentMockedAgent()

        const { default: mongodb } = await import('mongodb')
        ctx.nr.mongodb = mongodb

        await dropTestCollections(mongodb)
        METRIC_HOST_NAME = common.getHostName(ctx.nr.agent)
        METRIC_HOST_PORT = common.getPort()
        ctx.nr.METRIC_HOST_NAME = METRIC_HOST_NAME
        ctx.nr.METRIC_HOST_PORT = METRIC_HOST_PORT
        const res = await common.connect({ mongodb, name: DB_NAME })
        ctx.nr.client = res.client
        ctx.nr.db = res.db
        ctx.nr.collection = ctx.nr.db.collection(COLLECTIONS.collection1)
        await populate(ctx.nr.collection)
      })

      t.afterEach(async (ctx) => {
        await common.close(ctx.nr.client, ctx.nr.db)
        helper.unloadAgent(ctx.nr.agent)
      })

      await t.test('should not error outside of a transaction', (t, end) => {
        const { agent, collection } = t.nr
        assert.equal(agent.getTransaction(), undefined, 'should not be in a transaction')
        run(collection, function (err) {
          assert.ifError(err, 'running test should not error')
          assert.equal(
            agent.getTransaction(),
            undefined,
            'should not somehow gain a transaction'
          )
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
              const children = transaction.trace.getChildren(current.id)

              if (childrenLength === 2) {
                // aggregate path: sibling segments at the trace root
                assert.equal(children.length, childrenLength, 'should have two children')

                segments.forEach((expectedSegment, i) => {
                  const child = children[i]
                  const childChildren = transaction.trace.getChildren(child.id)

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
                    assert.equal(childChildren.length, 0, 'should have no more children')
                  }
                })
              } else {
                let currentChildren
                for (let i = 0, l = segments.length; i < l; ++i) {
                  const ch = transaction.trace.getChildren(current.id)
                  assert.equal(ch.length, childrenLength, 'should have one child')
                  current = ch[0]
                  currentChildren = transaction.trace.getChildren(current.id)
                  assert.equal(
                    current.name,
                    segments[i],
                    'child should be named ' + segments[i]
                  )
                  if (common.MONGO_SEGMENT_RE.test(current.name)) {
                    checkSegmentParams(current)
                    assert.equal(current.ignore, false, 'should not ignore segment')
                  }
                }

                if (strict) {
                  assert.equal(currentChildren.length, 0, 'should have no more children')
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
                metrics,
                prefix: STATEMENT_PREFIX
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
              ;[current] = tx.trace.getChildren(current.id)
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
              ;[current] = tx.trace.getChildren(current.id)
            }
            end()
          })
        })
      })
    })
  })
}

function checkSegmentParams(segment) {
  let dbName = DB_NAME
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
      i,
      next3: [i + 1, i + 2, i + 3],
      data: Math.random().toString(36).slice(2),
      mod10: i % 10,
      // spiral out
      loc: [i % 4 && (i + 1) % 4 ? i : -i, (i + 1) % 4 && (i + 2) % 4 ? i : -i]
    })
  }

  await collection.insertMany(items)
}

async function dropTestCollections(mongodb) {
  const collections = Object.values(COLLECTIONS)
  const { client, db } = await common.connect({ mongodb, name: DB_NAME })

  const dbCollections = (await db.listCollections().toArray()).map((c) => c.name)
  for (const collection of collections) {
    if (dbCollections.includes(collection) === false) {
      continue
    }
    try {
      await db.dropCollection(collection)
    } catch {}
  }

  await common.close(client, db)
}
