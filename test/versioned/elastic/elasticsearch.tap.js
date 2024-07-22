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
const DB_INDEX_3 = `test3-${randomString()}`
const SEARCHTERM_1 = randomString()

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
    // Determine version. ElasticSearch v7 did not export package, so we have to read the file
    // instead of requiring it, as we can with 8+.
    const pkg = await readFile(`${__dirname}/node_modules/@elastic/elasticsearch/package.json`)
    ;({ version: pkgVersion } = JSON.parse(pkg.toString()))

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
        {
          title: 'Sixth Bulk Doc',
          body: `Content of sixth bulk document. Has search term: ${SEARCHTERM_1}`
        },
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

  t.test('should record bulk operations triggered by client helpers', async (t) => {
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const operations = [
        { title: 'Ninth Bulk Doc from helpers', body: 'Content of ninth bulk document' },
        { title: 'Tenth Bulk Doc from helpers', body: 'Content of tenth bulk document.' },
        { title: 'Eleventh Bulk Doc from helpers', body: 'Content of eleventh bulk document.' },
        { title: 'Twelfth Bulk Doc from helpers', body: 'Content of twelfth bulk document.' },
        {
          title: 'Thirteenth Bulk Doc from helpers',
          body: 'Content of thirteenth bulk document'
        },
        {
          title: 'Fourteenth Bulk Doc from helpers',
          body: 'Content of fourteenth bulk document.'
        },
        { title: 'Fifteenth Bulk Doc from helpers', body: 'Content of fifteenth bulk document.' },
        { title: 'Sixteenth Bulk Doc from helpers', body: 'Content of sixteenth bulk document.' }
      ]
      await client.helpers.bulk({
        datasource: operations,
        onDocument() {
          return {
            index: { _index: DB_INDEX_2 }
          }
        },
        refreshOnCompletion: true
      })
      t.ok(transaction, 'transaction should still be visible after bulk create')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      t.ok(trace?.root?.children?.[1], 'trace, trace root, and second child should exist')
      // helper interface results in a first child of timers.setTimeout, with the second child related to the operation
      const secondChild = trace.root.children[1]
      t.equal(
        secondChild.name,
        'Datastore/statement/ElasticSearch/any/bulk.create',
        'should record bulk operation'
      )
    })
  })

  t.test('should record search with query string', async function (t) {
    // enable slow queries
    agent.config.transaction_tracer.slow_query_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const expectedQuery = { q: SEARCHTERM_1 }
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
    agent.config.transaction_tracer.slow_query_threshold = 0
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
    agent.config.transaction_tracer.slow_query_threshold = 0
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
  t.test('should record msearch', async function (t) {
    agent.config.transaction_tracer.slow_query_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
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

      t.ok(results, 'msearch should return results')
      t.equal(results?.length, 2, 'there should be two responses--one per search')
      t.equal(results?.[0]?.hits?.hits?.length, 1, 'first search should return one result')
      t.equal(results?.[1]?.hits?.hits?.length, 10, 'second search should return ten results')
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        'Datastore/statement/ElasticSearch/any/msearch.create',
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

  t.test('should record msearch via helpers', async function (t) {
    agent.config.transaction_tracer.slow_query_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      const m = client.helpers.msearch()
      const searchA = await m.search({}, { query: { match: { body: SEARCHTERM_1 } } })
      const searchB = await m.search({}, { query: { match: { body: 'bulk' } } })
      const resultsA = searchA?.body?.hits
      const resultsB = searchB?.body?.hits

      t.ok(resultsA, 'msearch for sixth should return results')
      t.ok(resultsB, 'msearch for bulk should return results')
      t.equal(resultsA?.hits?.length, 1, 'first search should return one result')
      t.equal(resultsB?.hits?.length, 10, 'second search should return ten results')
      t.ok(transaction, 'transaction should still be visible after search')
      const trace = transaction.trace
      t.ok(trace?.root?.children?.[0], 'trace, trace root, and first child should exist')
      const firstChild = trace.root.children[0]
      t.match(
        firstChild.name,
        'timers.setTimeout',
        'helpers, for some reason, generates a setTimeout metric first'
      )
      transaction.end()
      t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
      for (const query of agent.queries.samples.values()) {
        // which query gets captured in helper.msearch is non-deterministic
        t.ok(query.total > 0, 'the samples should have positive duration')
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

test('Elasticsearch uninstrumented behavior, to check helpers', { skip: false }, (t) => {
  t.autoend()

  let client
  // eslint-disable-next-line no-unused-vars
  let pkgVersion

  t.before(async () => {
    // Determine version. ElasticSearch v7 did not export package, so we have to read the file
    // instead of requiring it, as we can with 8+.
    const pkg = await readFile(`${__dirname}/node_modules/@elastic/elasticsearch/package.json`)
    ;({ version: pkgVersion } = JSON.parse(pkg.toString()))

    const { Client } = require('@elastic/elasticsearch')
    client = new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    })

    return Promise.all([client.indices.create({ index: DB_INDEX_3 })])
  })

  t.teardown(() => {
    return Promise.all([client.indices.delete({ index: DB_INDEX_3 })])
  })

  t.test('should record bulk operations triggered by client helpers', async (t) => {
    const operations = [
      {
        title: 'Uninstrumented First Bulk Doc from helpers',
        body: 'Content of uninstrumented first bulk document'
      },
      {
        title: 'Uninstrumented Second Bulk Doc from helpers',
        body: 'Content of uninstrumented second bulk document.'
      },
      {
        title: 'Uninstrumented Third Bulk Doc from helpers',
        body: 'Content of uninstrumented third bulk document.'
      },
      {
        title: 'Uninstrumented Fourth Bulk Doc from helpers',
        body: 'Content of uninstrumented fourth bulk document.'
      },
      {
        title: 'Uninstrumented Fifth Bulk Doc from helpers',
        body: 'Content of uninstrumented fifth bulk document'
      },
      {
        title: 'Uninstrumented Sixth Bulk Doc from helpers',
        body: 'Content of uninstrumented sixth bulk document.'
      },
      {
        title: 'Uninstrumented Seventh Bulk Doc from helpers',
        body: 'Content of uninstrumented seventh bulk document.'
      },
      {
        title: 'Uninstrumented Eighth Bulk Doc from helpers',
        body: 'Content of uninstrumented eighth bulk document.'
      }
    ]
    const result = await client.helpers.bulk({
      datasource: operations,
      onDocument() {
        return {
          index: { _index: DB_INDEX_3 }
        }
      }
      // refreshOnCompletion: true
    }) // setBulkBody(operations, pkgVersion)
    t.ok(result, 'We should have been able to create bulk entries without error')
    t.equal(result.total, 8, 'We should have been inserted eight records')
  })
  t.test('should be able to check bulk insert with msearch via helpers', async function (t) {
    const m = client.helpers.msearch()
    const searchA = await m.search({ index: DB_INDEX_3 }, { query: { match: { body: 'sixth' } } })
    const searchB = await m.search(
      { index: DB_INDEX_3 },
      { query: { match: { body: 'uninstrumented' } } }
    )
    const resultsA = searchA?.body?.hits
    const resultsB = searchB?.body?.hits

    t.ok(resultsA, 'msearch should return a response for A')
    t.ok(resultsB, 'msearch should return results for B')
    // some versions of helper msearch seem not to return results for the first search.
    // t.equal(resultsA?.hits?.length, 1, 'first search should return one result')
    t.equal(resultsB?.hits?.length, 8, 'second search should return eight results')
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
