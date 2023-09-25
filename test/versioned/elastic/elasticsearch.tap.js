/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

test('Elasticsearch instrumentation', { timeout: 20000 }, (t) => {
  t.autoend()

  let METRIC_HOST_NAME = null
  let HOST_ID = null
  const DB_INDEX = `test`
  const DB_INDEX_2 = `test2`

  let agent
  let client

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()

    METRIC_HOST_NAME = urltils.isLocalhost(params.elastic_host)
      ? agent.config.getHostnameSafe()
      : params.elastic_host
    HOST_ID = METRIC_HOST_NAME + '/' + params.elastic_port

    // need to capture attributes
    agent.config.attributes.enabled = true

    const { Client, HttpConnection } = require('@elastic/elasticsearch')
    client = new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`,
      auth: {
        username: params.elastic_user,
        password: params.elastic_pass
      },
      Connection: HttpConnection
    })
  })

  t.afterEach(async () => {
    agent && helper.unloadAgent(agent)
  })

  t.teardown(async () => {
    await client.indices.delete({ index: DB_INDEX })
    await client.indices.delete({ index: DB_INDEX_2 })
  })

  t.test('should be able to record creating an index', async (t) => {
    await helper.runInTransaction(agent, async function transactionInScope() {
      t.ok(agent.getTransaction(), 'transaction should be visible')
      try {
        await client.indices.create({ index: DB_INDEX })
        await client.indices.create({ index: DB_INDEX_2 })
      } catch (e) {
        t.notOk(e, 'indices should be created without error')
      }
      const transaction = agent.getTransaction()
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/test/index.update',
        'should record index PUT as update'
      )
    })
  })

  t.test('should record bulk operations', async (t) => {
    await helper.runInTransaction(agent, async function transactionInScope() {
      t.ok(agent.getTransaction(), 'transaction should be visible')

      try {
        await client.bulk({
          refresh: true,
          operations: [
            { index: { _index: DB_INDEX } },
            { title: 'First Bulk Doc', body: 'Content of first bulk document' },
            { index: { _index: DB_INDEX } },
            { title: 'Second Bulk Doc', body: 'Content of second bulk document.' },
            { index: { _index: DB_INDEX } },
            { title: 'Third Bulk Doc', body: 'Content of third bulk document.' },
            { index: { _index: DB_INDEX } },
            { title: 'Fourth Bulk Doc', body: 'Content of fourth bulk document.' },
            { index: { _index: DB_INDEX_2 } },
            { title: 'Fifth Bulk Doc', body: 'Content of fifth bulk document' },
            { index: { _index: DB_INDEX_2 } },
            { title: 'Sixth Bulk Doc', body: 'Content of sixth bulk document.' },
            { index: { _index: DB_INDEX_2 } },
            { title: 'Seventh Bulk Doc', body: 'Content of seventh bulk document.' },
            { index: { _index: DB_INDEX_2 } },
            { title: 'Eighth Bulk Doc', body: 'Content of eighth bulk document.' }
          ]
        })
      } catch (e) {
        t.notOk(e, 'Bulk operations should not error')
      }
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should still be visible after bulk create')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/bulk.create',
        'should record bulk operation'
      )
    })
  })

  t.test('should record search with query string', async function (t) {
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope() {
      const expectedQuery = { q: 'sixth' }
      const search = await client.search({ index: DB_INDEX_2, q: 'sixth' })
      t.ok(search, 'search should return a result')
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        'Datastore/statement/ElasticSearch/test2/search',
        'querystring search should be recorded as a search'
      )
      const attrs = firstChild.getAttributes()
      t.match(attrs.product, 'ElasticSearch')
      t.match(attrs.host, METRIC_HOST_NAME)
      transaction.end()
      // can we inspect recorded query?
      t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        t.ok(query.total > 0, 'the samples should have positive duration')
        t.match(
          query.trace.query,
          JSON.stringify(expectedQuery),
          'expected query string should have been used'
        )
      }
    })
  })
  t.test('should record search with request body', async function (t) {
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope() {
      const expectedQuery = { match: { body: 'document' } }
      const search = await client.search({ index: DB_INDEX, query: expectedQuery })
      t.ok(search, 'search should return a result')
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        'Datastore/statement/ElasticSearch/test/search',
        'search index is specified, so name shows it'
      )
      const attrs = firstChild.getAttributes()
      t.match(attrs.product, 'ElasticSearch')
      t.match(attrs.host, METRIC_HOST_NAME)
      transaction.end()
      // can we inspect recorded query?
      t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        t.ok(query.total > 0, 'the samples should have positive duration')
        t.match(
          query.trace.query,
          JSON.stringify({ query: expectedQuery }),
          'expected query body should have been recorded'
        )
      }
    })
  })

  t.test('should record search across indices', async function (t) {
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope() {
      const expectedQuery = { match: { body: 'document' } }
      const search = await client.search({ query: expectedQuery })
      t.ok(search, 'search should return a result')
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/search',
        'child name on all indices should show search'
      )
      const attrs = firstChild.getAttributes()
      t.match(attrs.product, 'ElasticSearch')
      t.match(attrs.host, METRIC_HOST_NAME)
      transaction.end()
      // can we inspect recorded query?
      t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        t.ok(query.total > 0, 'the samples should have positive duration')
        t.match(
          query.trace.query,
          JSON.stringify({ query: expectedQuery }),
          'expected query body should have been recorded'
        )
      }
    })
  })
  t.test('should record msearch', async function (t) {
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope() {
      const expectedQuery = [
        {}, // cross-index searches have can have an empty metadata section
        { query: { match: { body: 'sixth' } } },
        {},
        { query: { match: { body: 'bulk' } } }
      ]

      const search = await client.msearch({
        searches: expectedQuery
      })
      t.ok(search?.responses, 'msearch should return results')
      t.equal(search?.responses?.length, 2, 'there should be two responses--one per search')
      t.equal(
        search?.responses?.[0]?.hits?.hits?.length,
        1,
        'first search should return one result'
      )
      t.equal(
        search?.responses?.[1]?.hits?.hits?.length,
        8,
        'second search should return eight results'
      )
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/msearch',
        'child name should show msearch'
      )
      const attrs = firstChild.getAttributes()
      t.match(attrs.product, 'ElasticSearch')
      t.match(attrs.host, METRIC_HOST_NAME)
      transaction.end()
      t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        t.ok(query.total > 0, 'the samples should have positive duration')
        t.match(
          query.trace.query,
          JSON.stringify(expectedQuery),
          'expected msearch query should have been recorded'
        )
      }
    })
  })

  t.test('should create correct metrics', async function (t) {
    t.plan(28)
    await helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()

      try {
        await client.index({
          index: DB_INDEX,
          id: 'testkey2',
          document: {
            title: 'second document',
            body: 'body of the second document'
          }
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
      }

      // check metrics/methods for "exists" queries
      await client.exists({ id: 'testkey2', index: DB_INDEX })
      await client.get({ id: 'testkey2', index: DB_INDEX })
      await client.search({ query: { match: { body: 'document' } } })
      await client.delete({ id: 'testkey2', index: DB_INDEX })
      transaction.end()

      const unscoped = transaction.metrics.unscoped
      const expected = {
        'Datastore/all': 5,
        'Datastore/allWeb': 5,
        'Datastore/ElasticSearch/all': 5,
        'Datastore/ElasticSearch/allWeb': 5,
        'Datastore/operation/ElasticSearch/doc.update': 1,
        'Datastore/operation/ElasticSearch/doc.get': 1,
        'Datastore/operation/ElasticSearch/doc.exists': 1,
        'Datastore/operation/ElasticSearch/search': 1,
        'Datastore/statement/ElasticSearch/test/doc.update': 1,
        'Datastore/statement/ElasticSearch/test/doc.get': 1,
        'Datastore/statement/ElasticSearch/test/doc.exists': 1,
        'Datastore/statement/ElasticSearch/test/doc.delete': 1,
        'Datastore/statement/ElasticSearch/any/search': 1
      }
      expected['Datastore/instance/ElasticSearch/' + HOST_ID] = 5
      checkMetrics(t, unscoped, expected)
    })
  })

  t.test('should not add instance attributes/metrics when disabled', async function (t) {
    t.plan(4)

    // disable
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    await helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()

      try {
        await client.index({
          index: DB_INDEX,
          id: 'testkey3',
          document: {
            title: 'third document title',
            body: 'body of the third document'
          }
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
        if (!t.error(e)) {
          return t.end()
        }
      }

      const createSegment = transaction.trace.root.children[0]
      const attributes = createSegment.getAttributes()
      t.equal(attributes.host, undefined, 'should not have host attribute')
      t.equal(attributes.port_path_or_id, undefined, 'should not have port attribute')
      t.equal(attributes.database_name, undefined, 'should not have db name attribute')

      transaction.end()
      const unscoped = transaction.metrics.unscoped
      t.equal(
        unscoped['Datastore/instance/ElasticSearch/' + HOST_ID],
        undefined,
        'should not have instance metric'
      )
    })
  })
})

function checkMetrics(t, metrics, expected) {
  Object.keys(expected).forEach(function (name) {
    t.ok(metrics[name], 'should have metric ' + name)
    if (metrics[name]) {
      t.equal(
        metrics[name].callCount,
        expected[name],
        'should have ' + expected[name] + ' calls for ' + name
      )
    }
  })
}
