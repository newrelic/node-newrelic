/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')
const { assertPackageMetrics } = require('../../lib/custom-assertions')
const semver = require('semver')
const DB_INDEX = helper.randomString('test-')
const DB_INDEX_2 = helper.randomString('test2-')
const SEARCHTERM_1 = helper.randomString()

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

test('Elasticsearch instrumentation', async (t) => {
  t.beforeEach(async (ctx) => {
    const pkgVersion = helper.readPackageVersion(__dirname, '@elastic/elasticsearch')

    const agent = helper.instrumentMockedAgent()

    const METRIC_HOST_NAME = urltils.isLocalhost(params.elastic_host)
      ? agent.config.getHostnameSafe()
      : params.elastic_host
    const HOST_ID = METRIC_HOST_NAME + '/' + params.elastic_port

    // need to capture attributes
    agent.config.attributes.enabled = true

    const { Client } = require('@elastic/elasticsearch')
    const client = new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    })

    ctx.nr = {
      agent,
      client,
      pkgVersion,
      METRIC_HOST_NAME,
      HOST_ID
    }

    return Promise.all([
      client.indices.create({ index: DB_INDEX }),
      client.indices.create({ index: DB_INDEX_2 })
    ])
  })

  t.afterEach((ctx) => {
    const { agent, client } = ctx.nr
    helper.unloadAgent(agent)
    return Promise.all([
      client.indices.delete({ index: DB_INDEX }),
      client.indices.delete({ index: DB_INDEX_2 })
    ])
  })

  await t.test('should be able to record creating an index', async (t) => {
    const { agent, client } = t.nr
    const index = helper.randomString('test-index-')
    t.after(async () => {
      await client.indices.delete({ index })
    })
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      assert.ok(transaction, 'transaction should be visible')
      await client.indices.create({ index })
      const trace = transaction.trace
      // should only have two segments: the root and the index create, verifies opaque is working
      assert.equal(transaction.numSegments, 2)
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        `Datastore/statement/ElasticSearch/${index}/index.create`,
        'should record index PUT as create'
      )
    })
  })

  await t.test('should be able to record creating an index(callback)', async (t) => {
    const { agent, client, pkgVersion } = t.nr
    if (semver.gte(pkgVersion, '8.0.0')) {
      return
    }

    const index = helper.randomString('test-index-')
    t.after(async () => {
      await client.indices.delete({ index })
    })
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      assert.ok(transaction, 'transaction should be visible')
      await new Promise((resolve) => {
        client.indices.create({ index }, (err) => {
          assert.ifError(err, 'should not error when creating index')
          const trace = transaction.trace
          // should only have two segments: the root and the index create, verifies opaque is working
          assert.equal(transaction.numSegments, 2)
          const [firstChild] = trace.getChildren(trace.root.id)
          assert.equal(
            firstChild.name,
            `Datastore/statement/ElasticSearch/${index}/index.create`,
            'should record index PUT as create'
          )
          resolve()
        })
      })
    })
  })

  await t.test('should record bulk operations', async (t) => {
    const { agent, client, pkgVersion } = t.nr
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      await bulkInsert({ client, pkgVersion })
      assert.ok(transaction, 'transaction should still be visible after bulk create')
      const trace = transaction.trace
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/bulk.create',
        'should record bulk operation'
      )
    })
  })

  await t.test('should record bulk operations triggered by client helpers', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const operations = getBulkData()
      await client.helpers.bulk({
        datasource: operations,
        onDocument() {
          return {
            index: { _index: DB_INDEX_2 }
          }
        },
        refreshOnCompletion: true
      })
      assert.ok(transaction, 'transaction should still be visible after bulk create')
      const trace = transaction.trace
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/bulk.create',
        'should record bulk operation'
      )
    })
  })

  await t.test('should record search with query string', async function (t) {
    const { agent, client, METRIC_HOST_NAME } = t.nr
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const expectedQuery = { q: SEARCHTERM_1 }
      const search = await client.search({ index: DB_INDEX_2, ...expectedQuery })
      assert.ok(search, 'search should return a result')
      assert.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        `Datastore/statement/ElasticSearch/${DB_INDEX_2}/search`,
        'querystring search should be recorded as a search'
      )
      const attrs = firstChild.getAttributes()
      assert.equal(attrs.product, 'ElasticSearch')
      assert.equal(attrs.host, METRIC_HOST_NAME)
      transaction.end()
      assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        assert.ok(query.total > 0, 'the samples should have positive duration')
        assert.equal(
          query.trace.query,
          JSON.stringify(expectedQuery),
          'expected query string should have been used'
        )
      }
    })
  })
  await t.test('should record search with request body', async function (t) {
    const { agent, client, pkgVersion, METRIC_HOST_NAME } = t.nr
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      // We expect this content in the trace of the request, but the request body is different in 7 v 8.
      const expectedQuery = { query: { match: { body: 'document' } } }
      const requestBody = setRequestBody(expectedQuery, pkgVersion)
      const search = await client.search({ index: DB_INDEX, ...requestBody })
      assert.ok(search, 'search should return a result')
      assert.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        `Datastore/statement/ElasticSearch/${DB_INDEX}/search`,
        'search index is specified, so name shows it'
      )
      const attrs = firstChild.getAttributes()
      assert.equal(attrs.product, 'ElasticSearch')
      assert.equal(attrs.host, METRIC_HOST_NAME)
      assert.equal(attrs.port_path_or_id, `${params.elastic_port}`)
      transaction.end()
      assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        assert.ok(query.total > 0, 'the samples should have positive duration')
        assert.equal(
          query.trace.query,
          JSON.stringify({ ...expectedQuery }),
          'expected query body should have been recorded'
        )
      }
    })
  })

  await t.test('should record search across indices', async function (t) {
    const { agent, client, pkgVersion, METRIC_HOST_NAME } = t.nr
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const expectedQuery = { query: { match: { body: 'document' } } }
      const requestBody = setRequestBody(expectedQuery, pkgVersion)
      const search = await client.search({ ...requestBody })
      assert.ok(search, 'search should return a result')
      assert.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/search',
        'child name on all indices should show search'
      )
      const attrs = firstChild.getAttributes()
      assert.equal(attrs.product, 'ElasticSearch')
      assert.equal(attrs.host, METRIC_HOST_NAME)
      transaction.end()
      assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        assert.ok(query.total > 0, 'the samples should have positive duration')
        assert.equal(
          query.trace.query,
          JSON.stringify({ ...expectedQuery }),
          'expected query body should have been recorded'
        )
      }
    })
  })
  await t.test('should record msearch', async function (t) {
    const { agent, client, METRIC_HOST_NAME, pkgVersion } = t.nr
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await bulkInsert({ client, pkgVersion })
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const expectedQuery = [
        {}, // cross-index searches have can have an empty metadata section
        { query: { match: { body: SEARCHTERM_1 } } },
        {},
        { query: { match: { body: 'bulk' } } }
      ]
      const requestBody = setMsearch(expectedQuery, pkgVersion)
      const search = await client.msearch(requestBody)
      // 7 and 8 have different result responses
      let results = search?.responses
      if (!search?.responses && semver.lt(pkgVersion, '8.0.0')) {
        results = search?.body?.responses
      }

      assert.ok(results, 'msearch should return results')
      assert.equal(results?.length, 2, 'there should be two responses--one per search')
      assert.equal(results?.[0]?.hits?.hits?.length, 1, 'first search should return one result')
      assert.equal(results?.[1]?.hits?.hits?.length, 8, 'second search should return ten results')
      assert.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/msearch.create',
        'child name should show msearch'
      )
      const attrs = firstChild.getAttributes()
      assert.equal(attrs.product, 'ElasticSearch')
      assert.equal(attrs.host, METRIC_HOST_NAME)
      transaction.end()
      assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        assert.ok(query.total > 0, 'the samples should have positive duration')
        assert.equal(
          query.trace.query,
          JSON.stringify(expectedQuery),
          'expected msearch query should have been recorded'
        )
      }
    })
  })

  await t.test('should record msearch via helpers', async function (t) {
    const { agent, client, pkgVersion } = t.nr
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await bulkInsert({ client, pkgVersion })
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const m = client.helpers.msearch()
      const searchA = await m.search({}, { query: { match: { body: SEARCHTERM_1 } } })
      const searchB = await m.search({}, { query: { match: { body: 'bulk' } } })
      const resultsA = searchA?.body?.hits
      const resultsB = searchB?.body?.hits

      assert.ok(resultsA, 'msearch for sixth should return results')
      assert.ok(resultsB, 'msearch for bulk should return results')
      assert.equal(resultsA?.hits?.length, 1, 'first search should return one result')
      assert.equal(resultsB?.hits?.length, 8, 'second search should return ten results')
      assert.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      const [firstChild] = trace.getChildren(trace.root.id)
      assert.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/msearch.create'
      )
      transaction.end()
      assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        // which query gets captured in helper.msearch is non-deterministic
        assert.ok(query.total > 0, 'the samples should have positive duration')
      }
    })
  })

  await t.test('should create correct metrics', async function (t) {
    const { agent, client, pkgVersion, HOST_ID } = t.nr
    const id = helper.randomString('key-')
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
      checkMetrics(unscoped, expected)
      const pkgName = '@elastic/elasticsearch'
      assertPackageMetrics({ agent, pkg: pkgName, version: pkgVersion })
    })
  })

  await t.test('should not add instance attributes/metrics when disabled', async function (t) {
    const { agent, client, pkgVersion, HOST_ID } = t.nr

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

      const [createSegment] = transaction.trace.getChildren(transaction.trace.root.id)
      const attributes = createSegment.getAttributes()
      assert.equal(attributes.host, undefined, 'should not have host attribute')
      assert.equal(attributes.port_path_or_id, undefined, 'should not have port attribute')
      assert.equal(attributes.database_name, undefined, 'should not have db name attribute')

      transaction.end()
      const unscoped = transaction.metrics.unscoped
      assert.equal(
        unscoped['Datastore/instance/ElasticSearch/' + HOST_ID],
        undefined,
        'should not have instance metric'
      )
    })
  })
  await t.test('edge cases', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      try {
        await client.indices.create({ index: '_search' })
      } catch (e) {
        assert.ok(e, 'should not be able to create an index named _search')
      }
      const [firstChild] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(
        firstChild.name,
        'Datastore/statement/ElasticSearch/_search/index.create',
        'should record the attempted index creation without altering the index name'
      )
    })
  })
  await t.test('index existence check should not error', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async function transactionInScope() {
      try {
        await client.indices.exists({ index: DB_INDEX })
      } catch (e) {
        assert.ok(!e, 'should be able to check for index existence')
      }
    })
  })
})

function getBulkData(includeIndex) {
  let operations = [
    { title: 'First Bulk Doc', body: 'Content of first bulk document' },
    { title: 'Second Bulk Doc', body: 'Content of second bulk document.' },
    { title: 'Third Bulk Doc', body: 'Content of third bulk document.' },
    { title: 'Fourth Bulk Doc', body: 'Content of fourth bulk document.' },
    { title: 'Fifth Bulk Doc', body: 'Content of fifth bulk document' },
    {
      title: 'Sixth Bulk Doc',
      body: `Content of sixth bulk document. Has search term: ${SEARCHTERM_1}`
    },
    { title: 'Seventh Bulk Doc', body: 'Content of seventh bulk document.' },
    { title: 'Eighth Bulk Doc', body: 'Content of eighth bulk document.' }
  ]

  if (includeIndex) {
    operations = operations.flatMap((doc, i) => [{ index: { _index: i < 4 ? DB_INDEX : DB_INDEX_2 } }, doc])
  }

  return operations
}

async function bulkInsert({ client, pkgVersion }) {
  const operations = getBulkData(true)
  await client.bulk(setBulkBody(operations, pkgVersion))
}

function checkMetrics(metrics, expected) {
  Object.keys(expected).forEach(function (name) {
    assert.ok(metrics[name], 'should have metric ' + name)
    if (metrics[name]) {
      assert.equal(
        metrics[name].callCount,
        expected[name],
        'should have ' + expected[name] + ' calls for ' + name
      )
    }
  })
}
