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
const { tspl } = require('@matteo.collina/tspl')
const { assertPackageMetrics, assertMetrics, assertSegments, assertSpanKind } = require('../../lib/custom-assertions')

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

    await t.test('should log tracking metrics', function(t) {
      const { agent } = t.nr
      const { version } = require('memcached/package.json')
      assertPackageMetrics({ agent, pkg: 'memcached', version })
    })

    await t.test('touch()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.touch('foo', 1, function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/touch'],
            { exact: false },
            { assert: plan }
          )
          assertSpanKind({
            agent,
            segments: [
              { name: 'Datastore/operation/Memcache/touch', kind: 'client' }
            ],
            assert: plan
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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    await t.test('get()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/get', ['Truncated/Callback: <anonymous>']],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    await t.test('gets()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.gets('foo', function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/gets', ['Truncated/Callback: <anonymous>']],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    await t.test('getMulti()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.getMulti(['foo', 'bar'], function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/get', ['Truncated/Callback: handle']],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    await t.test('set()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/set', ['Truncated/Callback: <anonymous>']],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    await t.test('replace()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 13 })

      memcached.set('foo', 'bar', 10, function (err) {
        plan.ok(!err, 'should not throw error')

        helper.runInTransaction(agent, function transactionInScope(transaction) {
          memcached.replace('foo', 'new', 10, function (err) {
            plan.ok(!err, 'should not throw an error')
            plan.ok(agent.getTransaction(), 'transaction should still be visible')

            transaction.end()
            assertSegments(
              transaction.trace,
              transaction.trace.root,
              ['Datastore/operation/Memcache/replace', ['Truncated/Callback: <anonymous>']],
              { exact: false },
              { assert: plan }
            )

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
              { assert: plan }
            )
          })
        })
      })
      await plan.completed
    })

    await t.test('add()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.add('foo', 'bar', 10, function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/add', ['Truncated/Callback: <anonymous>']],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    await t.test('cas()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 14 })

      memcached.set('foo', 'bar', 10, function (err) {
        plan.ok(!err, 'set should not have errored')

        memcached.gets('foo', function (err, data) {
          plan.ok(!err, 'gets should not have errored')

          helper.runInTransaction(agent, function transactionInScope(transaction) {
            memcached.cas('foo', 'bar', data.cas, 10, function (err) {
              plan.ok(!err, 'should not throw an error')
              plan.ok(agent.getTransaction(), 'transaction should still be visible')

              transaction.end()
              assertSegments(
                transaction.trace,
                transaction.trace.root,
                ['Datastore/operation/Memcache/cas', ['Truncated/Callback: <anonymous>']],
                { exact: false },
                { assert: plan }
              )

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
                { assert: plan }
              )
            })
          })
        })
      })
      await plan.completed
    })

    await t.test('append()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 13 })

      memcached.set('foo', 'bar', 10, function (err) {
        plan.ok(!err)
        helper.runInTransaction(agent, function (transaction) {
          memcached.append('foo', 'bar', function (err) {
            plan.ok(!err)
            plan.ok(agent.getTransaction(), 'transaction should still be visible')
            transaction.end()
            assertSegments(
              transaction.trace,
              transaction.trace.root,
              ['Datastore/operation/Memcache/append', ['Truncated/Callback: <anonymous>']],
              { exact: false },
              { assert: plan }
            )

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
              { assert: plan }
            )
          })
        })
      })
      await plan.completed
    })

    await t.test('prepend()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 13 })

      memcached.set('foo', 'bar', 10, function (err) {
        plan.ok(!err)
        helper.runInTransaction(agent, function (transaction) {
          memcached.prepend('foo', 'bar', function (err) {
            plan.ok(!err)
            plan.ok(agent.getTransaction(), 'transaction should still be visible')
            transaction.end()
            assertSegments(
              transaction.trace,
              transaction.trace.root,
              ['Datastore/operation/Memcache/prepend', ['Truncated/Callback: <anonymous>']],
              { exact: false },
              { assert: plan }
            )

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
              { assert: plan }
            )
          })
        })
      })
      await plan.completed
    })

    await t.test('del()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 13 })

      memcached.set('foo', 'bar', 10, function (err) {
        plan.ok(!err)
        helper.runInTransaction(agent, function (transaction) {
          memcached.del('foo', function (err) {
            plan.ok(!err)
            plan.ok(agent.getTransaction(), 'transaction should still be visible')
            transaction.end()
            assertSegments(
              transaction.trace,
              transaction.trace.root,
              ['Datastore/operation/Memcache/delete', ['Truncated/Callback: <anonymous>']],
              { exact: false },
              { assert: plan }
            )

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
              { assert: plan }
            )
          })
        })
      })
      await plan.completed
    })

    await t.test('incr()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.incr('foo', 10, function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/incr', ['Truncated/Callback: <anonymous>']],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    await t.test('decr()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 11 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.decr('foo', 10, function (err) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/decr'],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })

    // memcached.version() is one of the calls that gets the second argument to
    // command.
    await t.test('version()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 12 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.version(function (err, ok) {
          plan.ok(!err, 'should not throw an error')
          plan.ok(ok, 'got a version')
          plan.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end()
          assertSegments(
            transaction.trace,
            transaction.trace.root,
            ['Datastore/operation/Memcache/version'],
            { exact: false },
            { assert: plan }
          )

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
            { assert: plan }
          )
        })
      })
      await plan.completed
    })
  })

  await t.test('captures attributes', async function (t) {
    t.beforeEach(async (ctx) => {
      const agent = helper.instrumentMockedAgent()

      // capture attributes
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

    await t.test('get()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 2 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function (err) {
          plan.ok(!err, 'should not throw an error')

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          plan.equal(segment.getAttributes().key, '"foo"', 'should have the get key as a parameter')
        })
      })
      await plan.completed
    })

    await t.test('get() when disabled', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 2 })
      agent.config.attributes.enabled = false

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function (err) {
          plan.ok(!err)

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          plan.ok(!segment.getAttributes().key, 'should not have any attributes')
        })
      })
      await plan.completed
    })

    await t.test('getMulti()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 2 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.getMulti(['foo', 'bar'], function (err) {
          plan.ok(!err, 'should not throw an error')

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          plan.equal(
            segment.getAttributes().key,
            '["foo","bar"]',
            'should have the multiple keys fetched as a parameter'
          )
        })
      })
      await plan.completed
    })

    await t.test('set()', async function (t) {
      const { agent, memcached } = t.nr
      const plan = tspl(t, { plan: 2 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function (err) {
          plan.ok(!err, 'should not throw an error')

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          plan.equal(segment.getAttributes().key, '"foo"', 'should have the set key as a parameter')
        })
      })
      await plan.completed
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

    await t.test('get()', async function (t) {
      const { agent, memcached, HOST_ID } = t.nr
      const plan = tspl(t, { plan: 7 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function (err) {
          plan.ok(!err, 'should not throw an error')

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          plan.equal(
            attributes.host,
            getMetricHostName(agent, params.memcached_host),
            'should collect host instance attributes'
          )
          plan.equal(
            attributes.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance attributes'
          )

          const expectedMetrics = [[{ name: `Datastore/instance/Memcache/${HOST_ID}` }]]
          assertMetrics(transaction.metrics, expectedMetrics, false, false, { assert: plan })
        })
      })
      await plan.completed
    })

    await t.test('set()', async function (t) {
      const { agent, memcached, HOST_ID } = t.nr
      const plan = tspl(t, { plan: 7 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function (err) {
          plan.ok(!err, 'should not throw an error')

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          plan.equal(
            attributes.host,
            getMetricHostName(agent, params.memcached_host),
            'should collect host instance attributes'
          )
          plan.equal(
            attributes.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance attributes'
          )

          const expectedMetrics = [[{ name: `Datastore/instance/Memcache/${HOST_ID}` }]]
          assertMetrics(transaction.metrics, expectedMetrics, false, false, { assert: plan })
        })
      })
      await plan.completed
    })
  })

  await t.test('does not capture datastore instance attributes when disabled', async function (t) {
    t.beforeEach(async (ctx) => {
      const agent = helper.instrumentMockedAgent()
      // disable
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

    await t.test('get()', async function (t) {
      const { agent, memcached, HOST_ID } = t.nr
      const plan = tspl(t, { plan: 4 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function (err) {
          plan.ok(!err, 'should not throw an error')

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          plan.equal(attributes.host, undefined, 'should not have host instance parameter')
          plan.equal(
            attributes.port_path_or_id,
            undefined,
            'should should not have port instance parameter'
          )

          const datastoreInstanceMetric = 'Datastore/instance/Memcache/' + HOST_ID
          plan.ok(
            !getMetrics(agent).unscoped[datastoreInstanceMetric],
            'should not have datastore instance metric'
          )
        })
      })
      await plan.completed
    })

    await t.test('set()', async function (t) {
      const { agent, memcached, HOST_ID } = t.nr
      const plan = tspl(t, { plan: 4 })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function (err) {
          plan.ok(!err, 'should not throw an error')

          transaction.end()
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          const attributes = segment.getAttributes()
          plan.equal(attributes.host, undefined, 'should not have host instance parameter')
          plan.equal(
            attributes.port_path_or_id,
            undefined,
            'should should not have port instance parameter'
          )

          const datastoreInstanceMetric = 'Datastore/instance/Memcache/' + HOST_ID
          plan.ok(
            !getMetrics(agent).unscoped[datastoreInstanceMetric],
            'should not have datastore instance metric'
          )
        })
      })
      await plan.completed
    })
  })

  await t.test('captures datastore instance attributes with multiple hosts', async function (t) {
    const realServer = params.memcached_host + ':' + params.memcached_port

    t.beforeEach(async (ctx) => {
      let Memcached = require('memcached')
      const origCommand = Memcached.prototype.command
      Memcached.prototype.command = function stubbedCommand(queryCompiler) {
        origCommand.call(this, queryCompiler, realServer)
      }

      // Then load the agent and reload memcached to ensure it gets instrumented.
      const agent = helper.instrumentMockedAgent()
      Memcached = require('memcached')
      const memcached = new Memcached(['server1:1111', 'server2:2222'])

      // Finally, change the hashring to something controllable.
      memcached.HashRing.get = function (key) {
        return key === 'foo' ? 'server1:1111' : 'server2:2222'
      }

      ctx.nr = {
        agent,
        memcached,
        origCommand,
        Memcached
      }
    })

    t.afterEach(async (ctx) => {
      const { agent, origCommand, Memcached, memcached } = ctx.nr
      helper.unloadAgent(agent)
      await flush(memcached)
      if (origCommand) {
        Memcached.prototype.command = origCommand
      }
    })

    function checkParams(segment, host, port) {
      const attributes = segment.getAttributes()
      assert.equal(attributes.host, host, 'should have correct host (' + host + ')')
      assert.equal(attributes.port_path_or_id, port, 'should have correct port (' + port + ')')
    }

    await t.test('separate gets', function (t, end) {
      const { agent, memcached } = t.nr
      helper.runInTransaction(agent, function (transaction) {
        memcached.get('foo', function (err) {
          assert.ok(!err)
          const firstSegment = transaction.trace.getParent(agent.tracer.getSegment().parentId)

          memcached.get('bar', function (err) {
            assert.ok(!err)
            transaction.end()
            checkParams(firstSegment, 'server1', '1111')
            checkParams(
              transaction.trace.getParent(agent.tracer.getSegment().parentId),
              'server2',
              '2222'
            )
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
          end()
        })
      })
    })
  })
})

function getMetrics(agent) {
  return agent.metrics._metrics
}
