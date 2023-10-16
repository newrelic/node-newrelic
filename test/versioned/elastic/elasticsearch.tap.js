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
const crypto = require('crypto')
const { readFile } = require('fs/promises')
const semver = require('semver')
const DB_INDEX = `test-${randomString()}`
const DB_INDEX_2 = `test2-${randomString()}`

function randomString() {
  return crypto.randomBytes(5).toString('hex')
}

// request bodies are structured differently in ElasticSearch v7.x vs v8.x
function setRequestBody(body, version) {
  if (semver.lt(version, '8.0.0')) {
    return { body }
  }
  return body
}
function setBulkBody(body, version) {
  if (semver.lt(version, '8.0.0')) {
    return {
      refresh: true,
      body
    }
  }
  return {
    refresh: true,
    operations: body
  }
}
function setMsearch(body, version) {
  if (semver.lt(version, '8.0.0')) {
    return { body }
  }
  return {
    searches: body
  }
}

test('Elasticsearch instrumentation', (t) => {
  t.autoend()

  let METRIC_HOST_NAME = null
  let HOST_ID = null

  let agent
  let client
  let pkgVersion

  t.before(async () => {
    // determine version
    const pkg = await readFile(`${__dirname}/node_modules/@elastic/elasticsearch/package.json`)
    const { version: esVersion } = JSON.parse(pkg.toString())
    pkgVersion = esVersion

    agent = helper.instrumentMockedAgent()

    METRIC_HOST_NAME = urltils.isLocalhost(params.elastic_host)
      ? agent.config.getHostnameSafe()
      : params.elastic_host
    HOST_ID = METRIC_HOST_NAME + '/' + params.elastic_port

    // need to capture attributes
    agent.config.attributes.enabled = true

    const { Client } = require('@elastic/elasticsearch')
    client = new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    })

    return Promise.all([
      client.indices.create({ index: DB_INDEX }),
      client.indices.create({ index: DB_INDEX_2 })
    ])
  })

  t.afterEach(() => {
    agent.queries.clear()
  })

  t.teardown(() => {
    agent && helper.unloadAgent(agent)
    return Promise.all([
      client.indices.delete({ index: DB_INDEX }),
      client.indices.delete({ index: DB_INDEX_2 })
    ])
  })

  t.test('should be able to record creating an index', async (t) => {
    const index = `test-index-${randomString()}`
    t.teardown(async () => {
      await client.indices.delete({ index })
    })
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      t.ok(transaction, 'transaction should be visible')
      await client.indices.create({ index })
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.equal(
        firstChild.name,
        `Datastore/statement/ElasticSearch/${index}/index.create`,
        'should record index PUT as create'
      )
    })
  })

  t.test('should record bulk operations', async (t) => {
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const operations = [
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

      await client.bulk(setBulkBody(operations, pkgVersion))
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
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const expectedQuery = { q: 'sixth' }
      const search = await client.search({ index: DB_INDEX_2, ...expectedQuery })
      t.ok(search, 'search should return a result')
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        `Datastore/statement/ElasticSearch/${DB_INDEX_2}/search`,
        'querystring search should be recorded as a search'
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
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      // We expect this content in the trace of the request, but the request body is different in 7 v 8.
      const expectedQuery = { query: { match: { body: 'document' } } }
      const requestBody = setRequestBody(expectedQuery, pkgVersion)
      const search = await client.search({ index: DB_INDEX, ...requestBody })
      t.ok(search, 'search should return a result')
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        `Datastore/statement/ElasticSearch/${DB_INDEX}/search`,
        'search index is specified, so name shows it'
      )
      const attrs = firstChild.getAttributes()
      t.equal(attrs.product, 'ElasticSearch')
      t.equal(attrs.host, METRIC_HOST_NAME)
      t.equal(attrs.port_path_or_id, `${params.elastic_port}`)
      // TODO: update once instrumentation is properly setting database name
      t.equal(attrs.database_name, 'unknown')
      transaction.end()
      t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        t.ok(query.total > 0, 'the samples should have positive duration')
        t.match(
          query.trace.query,
          JSON.stringify({ ...expectedQuery }),
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
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const expectedQuery = { query: { match: { body: 'document' } } }
      const requestBody = setRequestBody(expectedQuery, pkgVersion)
      const search = await client.search({ ...requestBody })
      t.ok(search, 'search should return a result')
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
      t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        t.ok(query.total > 0, 'the samples should have positive duration')
        t.match(
          query.trace.query,
          JSON.stringify({ ...expectedQuery }),
          'expected query body should have been recorded'
        )
      }
    })
  })
  // skipping for 7.x because the client converts body to bulkBody, causing an error
  t.test('should record msearch', async function (t) {
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const expectedQuery = [
        {}, // cross-index searches have can have an empty metadata section
        { query: { match: { body: 'sixth' } } },
        {},
        { query: { match: { body: 'bulk' } } }
      ]
      const requestBody = setMsearch(expectedQuery, pkgVersion)
      const search = await client.msearch(requestBody)
      // 7 and 8 have different result responses
      let results = search?.responses
      if (semver.lt(pkgVersion, '8.0.0')) {
        results = search?.body?.responses
      }

      t.ok(results, 'msearch should return results')
      t.equal(results?.length, 2, 'there should be two responses--one per search')
      t.equal(results?.[0]?.hits?.hits?.length, 1, 'first search should return one result')
      t.equal(results?.[1]?.hits?.hits?.length, 8, 'second search should return eight results')
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
    const id = `key-${randomString()}`
    t.plan(28)
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const documentProp = setRequestBody(
        {
          document: {
            title: 'second document',
            body: 'body of the second document'
          }
        },
        pkgVersion
      )
      await client.index({
        index: DB_INDEX,
        id,
        ...documentProp
      })

      // check metrics/methods for "exists" queries
      await client.exists({ id, index: DB_INDEX })
      await client.get({ id, index: DB_INDEX })
      const searchQuery = setRequestBody({ query: { match: { body: 'document' } } }, pkgVersion)
      await client.search(searchQuery)
      await client.delete({ id, index: DB_INDEX })
      transaction.end()

      const unscoped = transaction.metrics.unscoped
      const expected = {
        'Datastore/all': 5,
        'Datastore/allWeb': 5,
        'Datastore/ElasticSearch/all': 5,
        'Datastore/ElasticSearch/allWeb': 5,
        'Datastore/operation/ElasticSearch/doc.create': 1,
        'Datastore/operation/ElasticSearch/doc.get': 1,
        'Datastore/operation/ElasticSearch/doc.exists': 1,
        'Datastore/operation/ElasticSearch/search': 1,
        [`Datastore/statement/ElasticSearch/${DB_INDEX}/doc.create`]: 1,
        [`Datastore/statement/ElasticSearch/${DB_INDEX}/doc.get`]: 1,
        [`Datastore/statement/ElasticSearch/${DB_INDEX}/doc.exists`]: 1,
        [`Datastore/statement/ElasticSearch/${DB_INDEX}/doc.delete`]: 1,
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

    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const documentProp = setRequestBody(
        {
          document: {
            title: 'third document title',
            body: 'body of the third document'
          }
        },
        pkgVersion
      )

      await client.index({
        index: DB_INDEX,
        id: 'testkey3',
        ...documentProp
      })

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
  t.test('edge cases', async (t) => {
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      try {
        await client.indices.create({ index: '_search' })
      } catch (e) {
        t.ok(e, 'should not be able to create an index named _search')
      }
      const firstChild = transaction?.trace?.root?.children[0]
      t.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/_search/index.create',
        'should record the attempted index creation without altering the index name'
      )
    })
  })
  t.test('index existence check should not error', async (t) => {
    await helper.runInTransaction(agent, async function transactionInScope() {
      try {
        await client.indices.exists({ index: DB_INDEX })
      } catch (e) {
        t.notOk(e, 'should be able to check for index existence')
      }
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
