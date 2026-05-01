/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const { getMetricHostName } = require('../../lib/metrics_helper')
const { assertPackageMetrics, assertMetrics, assertSegmentDuration, assertSegments, assertSpanKind } = require('../../lib/custom-assertions')

test('memcached instrumentation', { timeout: 5000 }, async function (t) {
  await t.test('generates correct metrics and trace segments', async function (t) {
    t.beforeEach(async (ctx) => {
      const agent = helper.instrumentMockedAgent()
      const Memcached = require('memcached')
      const memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
      ctx.nr = {
        agent,
        memcached
      }
    })

    t.afterEach(async (ctx) => {
      const { agent, memcached } = ctx.nr
      helper.unloadAgent(agent)
      await flush(memcached)
    })

    await t.test('should log tracking metrics', async function (t) {
      const { agent, memcached } = t.nr
      const { version } = require('memcached/package.json')
      await helper.runInTransaction(agent, function (tx) {
        // Have to call simple memcached function to
        // create SubscriberUsed metric.
        memcached.touch('foo', 1, function (err) {
          assert.ok(!err, 'should not throw an error')
        })
        assertPackageMetrics({ agent, pkg: 'memcached', version, subscriberType: true })
        tx.end()
      })
    })

    await t.test('touch()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.touch('foo', 1, function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/touch')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/touch'],
          { exact: false },
          { assert }
        )
        transaction.end()
        assertSpanKind({
          agent,
          segments: [
            { name: 'Datastore/operation/Memcache/touch', kind: 'client' }
          ],
          assert
        })
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/touch' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('get()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.get('foo', function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/get')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/get'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/get' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('gets()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.gets('foo', function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/gets')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/gets'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/gets' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('getMulti()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.getMulti(['foo', 'bar'], function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/get')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/get'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/get' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('set()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.set('foo', 'bar', 10, function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/set')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/set'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/set' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('replace()', async function (t) {
      const { agent, memcached } = t.nr

      await new Promise((resolve, reject) => {
        memcached.set('foo', 'bar', 10, (err) => (err ? reject(err) : resolve()))
      })

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.replace('foo', 'new', 10, function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/replace')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/replace'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/replace' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('add()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.add('foo', 'bar', 10, function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/add')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/add'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/add' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('cas()', async function (t) {
      const { agent, memcached } = t.nr

      await new Promise((resolve, reject) => {
        memcached.set('foo', 'bar', 10, (err) => (err ? reject(err) : resolve()))
      })

      const data = await new Promise((resolve, reject) => {
        memcached.gets('foo', (err, result) => (err ? reject(err) : resolve(result)))
      })

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.cas('foo', 'bar', data.cas, 10, function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/cas')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/cas'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/cas' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('append()', async function (t) {
      const { agent, memcached } = t.nr

      await new Promise((resolve, reject) => {
        memcached.set('foo', 'bar', 10, (err) => (err ? reject(err) : resolve()))
      })

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.append('foo', 'bar', function (err) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/append')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/append'],
          { exact: false },
          { assert }
        )
        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/append' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('prepend()', async function (t) {
      const { agent, memcached } = t.nr

      await new Promise((resolve, reject) => {
        memcached.set('foo', 'bar', 10, (err) => (err ? reject(err) : resolve()))
      })

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.prepend('foo', 'bar', function (err) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/prepend')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/prepend'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/prepend' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('del()', async function (t) {
      const { agent, memcached } = t.nr

      await new Promise((resolve, reject) => {
        memcached.set('foo', 'bar', 10, (err) => (err ? reject(err) : resolve()))
      })

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.del('foo', function (err) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/delete')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/delete'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/delete' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('incr()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.incr('foo', 10, function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/incr')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/incr'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/incr' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('decr()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.decr('foo', 10, function (err) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/decr')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/decr'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/decr' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })

    await t.test('version()', async function (t) {
      const { agent, memcached } = t.nr

      await helper.runInTransaction(agent, async function (transaction) {
        const { segment } = await new Promise((resolve) => {
          memcached.version(function (err, ok) {
            assert.ok(!err, 'should not throw an error')
            assert.ok(ok, 'got a version')
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            resolve({ segment: agent.tracer.getSegment() })
          })
        })
        const actualTime = process.hrtime(segment.timer.hrstart)
        assertSegmentDuration({ segment, actualTime })
        assertSegmentState(segment, 'Datastore/operation/Memcache/version')

        assertSegments(
          transaction.trace,
          transaction.trace.root,
          ['Datastore/operation/Memcache/version'],
          { exact: false },
          { assert }
        )

        transaction.end()
        assertMetrics(
          transaction.metrics,
          [
            [{ name: 'Datastore/all' }],
            [{ name: 'Datastore/allWeb' }],
            [{ name: 'Datastore/Memcache/all' }],
            [{ name: 'Datastore/Memcache/allWeb' }],
            [{ name: 'Datastore/operation/Memcache/version' }]
          ],
          false,
          false,
          { assert }
        )
      })
    })
  })

  await t.test('captures attributes', async function (t) {
    t.beforeEach(async (ctx) => {
      const agent = helper.instrumentMockedAgent()
      agent.config.attributes.enabled = true
      const Memcached = require('memcached')
      const memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
      ctx.nr = {
        agent,
        memcached
      }
    })

    t.afterEach(async (ctx) => {
      const { agent, memcached } = ctx.nr
      helper.unloadAgent(agent)
      await flush(memcached)
    })

    await t.test('get()', function (t, end) {
      const { agent, memcached } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.get('foo', function (err) {
          assert.ok(!err, 'should not throw an error')

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          assert.equal(segment.getAttributes().key, '"foo"', 'should have the get key as a parameter')
          transaction.end()
          end()
        })
      })
    })

    await t.test('get() when disabled', function (t, end) {
      const { agent, memcached } = t.nr
      agent.config.attributes.enabled = false

      helper.runInTransaction(agent, function (transaction) {
        memcached.get('foo', function (err) {
          assert.ok(!err)

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          assert.ok(!segment.getAttributes().key, 'should not have any attributes')
          transaction.end()
          end()
        })
      })
    })

    await t.test('getMulti()', function (t, end) {
      const { agent, memcached } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.getMulti(['foo', 'bar'], function (err) {
          assert.ok(!err, 'should not throw an error')

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          assert.equal(
            segment.getAttributes().key,
            '["foo","bar"]',
            'should have the multiple keys fetched as a parameter'
          )
          transaction.end()
          end()
        })
      })
    })

    await t.test('set()', function (t, end) {
      const { agent, memcached } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.set('foo', 'bar', 10, function (err) {
          assert.ok(!err, 'should not throw an error')

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          assert.equal(segment.getAttributes().key, '"foo"', 'should have the set key as a parameter')

          transaction.end()
          end()
        })
      })
    })
  })

  await t.test('captures datastore instance attributes', async function (t) {
    t.beforeEach(async (ctx) => {
      const agent = helper.instrumentMockedAgent()
      const Memcached = require('memcached')
      const memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
      const hostName = getMetricHostName(agent, params.memcached_host)
      const HOST_ID = hostName + '/' + params.memcached_port
      ctx.nr = {
        agent,
        memcached,
        HOST_ID
      }
    })

    t.afterEach(async (ctx) => {
      const { agent, memcached } = ctx.nr
      helper.unloadAgent(agent)
      await flush(memcached)
    })

    await t.test('get()', function (t, end) {
      const { agent, memcached, HOST_ID } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.get('foo', function (err) {
          assert.ok(!err, 'should not throw an error')

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          assert.equal(
            attributes.host,
            getMetricHostName(agent, params.memcached_host),
            'should collect host instance attributes'
          )
          assert.equal(
            attributes.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance attributes'
          )

          transaction.end()
          const expectedMetrics = [[{ name: `Datastore/instance/Memcache/${HOST_ID}` }]]
          assertMetrics(transaction.metrics, expectedMetrics, false, false, { assert })
          end()
        })
      })
    })

    await t.test('set()', function (t, end) {
      const { agent, memcached, HOST_ID } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.set('foo', 'bar', 10, function (err) {
          assert.ok(!err, 'should not throw an error')

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          assert.equal(
            attributes.host,
            getMetricHostName(agent, params.memcached_host),
            'should collect host instance attributes'
          )
          assert.equal(
            attributes.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance attributes'
          )

          transaction.end()
          const expectedMetrics = [[{ name: `Datastore/instance/Memcache/${HOST_ID}` }]]
          assertMetrics(transaction.metrics, expectedMetrics, false, false, { assert })

          end()
        })
      })
    })
  })

  await t.test('does not capture datastore instance attributes when disabled', async function (t) {
    t.beforeEach(async (ctx) => {
      const agent = helper.instrumentMockedAgent()
      agent.config.datastore_tracer.instance_reporting.enabled = false
      const Memcached = require('memcached')
      const memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
      const hostName = getMetricHostName(agent, params.memcached_host)
      const HOST_ID = hostName + '/' + params.memcached_port
      ctx.nr = {
        agent,
        memcached,
        HOST_ID
      }
    })

    t.afterEach(async (ctx) => {
      const { agent, memcached } = ctx.nr
      helper.unloadAgent(agent)
      await flush(memcached)
    })

    await t.test('get()', function (t, end) {
      const { agent, memcached, HOST_ID } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.get('foo', function (err) {
          assert.ok(!err, 'should not throw an error')

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          assert.equal(attributes.host, undefined, 'should not have host instance parameter')
          assert.equal(
            attributes.port_path_or_id,
            undefined,
            'should should not have port instance parameter'
          )

          const datastoreInstanceMetric = 'Datastore/instance/Memcache/' + HOST_ID
          assert.ok(
            !getMetrics(agent).unscoped[datastoreInstanceMetric],
            'should not have datastore instance metric'
          )
          transaction.end()
          end()
        })
      })
    })

    await t.test('set()', function (t, end) {
      const { agent, memcached, HOST_ID } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.set('foo', 'bar', 10, function (err) {
          assert.ok(!err, 'should not throw an error')

          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          assert.equal(attributes.host, undefined, 'should not have host instance parameter')
          assert.equal(
            attributes.port_path_or_id,
            undefined,
            'should should not have port instance parameter'
          )

          const datastoreInstanceMetric = 'Datastore/instance/Memcache/' + HOST_ID
          assert.ok(
            !getMetrics(agent).unscoped[datastoreInstanceMetric],
            'should not have datastore instance metric'
          )
          transaction.end()
          end()
        })
      })
    })
  })

  await t.test('captures datastore instance attributes with multiple hosts', async function (t) {
    const realServer = params.memcached_host + ':' + params.memcached_port

    t.beforeEach(async (ctx) => {
      const agent = helper.instrumentMockedAgent()
      const Memcached = require('memcached')
      const memcached = new Memcached(['server1:1111', 'server2:2222'])

      // Stub connect to redirect all connections to the real server
      // while letting the subscriber see the correct logical server from HashRing.
      const origConnect = Memcached.prototype.connect
      Memcached.prototype.connect = function stubbedConnect(_server, callback) {
        origConnect.call(this, realServer, callback)
      }

      memcached.HashRing.get = function (key) {
        return key === 'foo' ? 'server1:1111' : 'server2:2222'
      }

      ctx.nr = {
        agent,
        memcached,
        origConnect,
        Memcached
      }
    })

    t.afterEach(async (ctx) => {
      const { agent, memcached, origConnect, Memcached } = ctx.nr
      helper.unloadAgent(agent)
      await flush(memcached)
      Memcached.prototype.connect = origConnect
    })

    await t.test('separate gets', function (t, end) {
      const { agent, memcached } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.get('foo', function (err) {
          assert.ok(!err)
          const { segment: fooSegment } = agent.tracer.getContext()

          memcached.get('bar', function (err) {
            assert.ok(!err)
            const { segment: barSegment } = agent.tracer.getContext()
            checkParams(fooSegment, 'server1', '1111')
            checkParams(barSegment, 'server2', '2222')
            transaction.end()
            end()
          })
        })
      })
    })

    await t.test('multi-get', function (t, end) {
      const { agent, memcached } = t.nr

      helper.runInTransaction(agent, function (transaction) {
        memcached.getMulti(['foo', 'bar'], function (err) {
          assert.ok(!err)
          const [firstGet, secondGet] = transaction.trace.getChildren(transaction.trace.root.id)
          if (firstGet.getAttributes().host === 'server1') {
            checkParams(firstGet, 'server1', '1111')
            checkParams(secondGet, 'server2', '2222')
          } else {
            checkParams(secondGet, 'server1', '1111')
            checkParams(firstGet, 'server2', '2222')
          }
          transaction.end()
          end()
        })
      })
    })
  })
})

/**
 * Asserts that the current segment has the expected name, has ended,
 * and has a duration within a reasonable threshold of the actual measured time.
 * @param {TraceSegment} segment segment to check
 * @param {string} expectedName expected segment name
 */
function assertSegmentState(segment, expectedName) {
  assert.equal(segment.name, expectedName)
  assert.equal(segment._isEnded(), true, 'segment should have ended')
  const segmentDuration = segment.getDurationInMillis()
  // TODO: Figure out a better way to assert segment durations; what is a good non-flaky threshold?
  assert.equal(segmentDuration > 0, true, 'segment duration should be greater than 0')
}

/**
 * Checks the database segment attributes, host and port.
 * @param {TraceSegment} segment `TraceSegment` to check
 * @param {string} host hostname to check
 * @param {string} port port number to check
 */
function checkParams(segment, host, port) {
  assert.ok(segment, 'segment should exist')
  const attributes = segment.getAttributes()
  assert.equal(attributes.host, host, 'should have correct host (' + host + ')')
  assert.equal(attributes.port_path_or_id, port, 'should have correct port (' + port + ')')
}

function getMetrics(agent) {
  return agent.metrics._metrics
}

/**
 * Flushes memcached to start clean
 *
 * @param {object} memcached instance of memcached
 */
function flush(memcached) {
  return new Promise((resolve, reject) => {
    memcached.flush((err) => {
      memcached.end()
      err ? reject(err) : resolve()
    })
  })
}
