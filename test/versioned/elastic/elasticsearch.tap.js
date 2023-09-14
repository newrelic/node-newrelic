/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')

const dbTools = (client) => {
  const createIndex = async (index) => {
    return await client.indices.create({
      index
    })
  }

  const indexExists = async (index) => {
    return await client.indices.exists({
      index
    })
  }

  const documentExists = async (index, id) => {
    return await client.exists({
      id,
      index
    })
  }

  const searchDocument = async (index, title) => {
    return await client.search({
      index,
      query: { fuzzy: { title } }
    })
  }

  const createDocument = async (index, id, document) => {
    return await client.index({
      index,
      id,
      document
    })
  }

  const deleteDocument = async (index, id) => {
    return await client.delete({
      id,
      index
    })
  }

  return {
    createIndex,
    indexExists,
    documentExists,
    searchDocument,
    createDocument,
    deleteDocument
  }
}

test('Elasticsearch instrumentation', { timeout: 20000 }, (t) => {
  t.autoend()

  let METRIC_HOST_NAME = null
  let HOST_ID = null
  const DB_INDEX = `test`
  const DB_INDEX_2 = `test2`

  let agent
  let client
  let db

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()

    // Elastic isn't using machine name.
    // METRIC_HOST_NAME = urltils.isLocalhost(params.elastic_host)
    //   ? agent.config.getHostnameSafe()
    //   : params.elastic_host
    METRIC_HOST_NAME = params.elastic_host
    // metric host id kind of wonky
    HOST_ID = 'http://' + METRIC_HOST_NAME + ':' + params.elastic_port + '//' + params.elastic_port

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
    if (!db) {
      db = dbTools(client)
    }

    // set up index
    const hasIndex = await db.indexExists(DB_INDEX)
    if (!hasIndex) {
      await db.createIndex(DB_INDEX)
    }

    // Start testing!
    // t.notOk(agent.getTransaction(), 'no transaction should be in play')
  })

  t.afterEach(async () => {
    // we may have to purge require cache of redis related instrumentation
    // otherwise it will not re-register on subsequent test runs
    // Object.keys(require.cache).forEach((key) => {
    //   if (/elastic/.test(key)) {
    //     delete require.cache[key]
    //   }
    // })

    agent && helper.unloadAgent(agent)
  })

  t.teardown(async () => {
    await client.indices.delete({ index: DB_INDEX })
    await client.indices.delete({ index: DB_INDEX_2 })
  })

  t.test('should find Elastic calls in the transaction trace', async function (t) {
    t.plan(18)
    await helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should be visible')

      let createDoc
      try {
        createDoc = await db.createDocument(DB_INDEX, 'testkey', {
          title: 'arglbargle',
          body: 'zimzamzoz'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
      }
      t.ok(agent.getTransaction(), 'transaction should still be visible after creating a document')
      t.ok(createDoc, 'creating a document should generate a response')

      const trace = transaction.trace
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist')

      t.equal(trace.root.children.length, 1, 'there should be only one child of the root')

      const createSegment = trace.root.children[0]
      const createAttributes = createSegment.getAttributes()

      t.ok(createSegment, 'trace segment for set should exist')
      t.equal(
        createSegment.name,
        'Datastore/statement/ElasticSearch/test/create',
        'should register the create'
      )
      t.equal(
        createAttributes.host,
        'http://localhost:9200/',
        'should have the host as a attribute'
      )
      t.equal(createSegment.children.length, 0, 'create does not have children')

      const value = await client.get({ id: 'testkey', index: DB_INDEX })
      t.ok(
        agent.getTransaction(),
        'transaction should still still be visible after getting a document'
      )
      t.hasProp(value, '_source', 'elastic value should have _source property')
      t.hasProp(value._source, 'title', 'elastic value._source should have the correct title')
      t.equal(value._source.title, 'arglbargle', 'elastic client should still work')

      const getSegment = trace.root.children[1]
      t.ok(getSegment, 'trace segment for get should exist')

      t.equal(
        getSegment.name,
        'Datastore/statement/ElasticSearch/test/other',
        'should register the get'
      )

      t.equal(getSegment.children.length, 0, 'get should have no child segments')

      t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
    })
  })

  t.test('should create correct metrics', async function (t) {
    t.plan(18)
    await helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()

      try {
        await db.createDocument(DB_INDEX, 'testkey2', {
          title: 'arglbargle',
          body: 'zimzamzoz'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
      }

      await client.get({ id: 'testkey2', index: DB_INDEX })
      transaction.end()

      const unscoped = transaction.metrics.unscoped
      const expected = {
        'Datastore/all': 2,
        'Datastore/allWeb': 2,
        'Datastore/ElasticSearch/all': 2,
        'Datastore/ElasticSearch/allWeb': 2,
        'Datastore/operation/ElasticSearch/create': 1,
        'Datastore/operation/ElasticSearch/other': 1,
        'Datastore/statement/ElasticSearch/test/create': 1,
        'Datastore/statement/ElasticSearch/test/other': 1
      }
      expected['Datastore/instance/ElasticSearch/' + HOST_ID] = 2
      checkMetrics(t, unscoped, expected)
    })
  })

  t.test('should not add `id` attribute to trace segment', async function (t) {
    agent.config.attributes.enabled = true

    await helper.runInTransaction(agent, async function () {
      try {
        await db.createDocument(DB_INDEX, 'saveme2', {
          title: 'foobar2',
          body: 'bazbap2'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
      }

      const segment = agent.tracer.getSegment()
      const firstChild = segment.children[0]
      const attrs = firstChild.getAttributes()
      t.ok(firstChild, 'segment should have a child')
      t.ok(attrs, 'should have attributes')
      t.notOk(attrs.id, 'should not have id attribute')
    })
  })

  t.test('should add datastore instance attributes to trace segments', async function (t) {
    t.plan(4)

    // Enable.
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    await helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      try {
        await db.createDocument(DB_INDEX, 'testkey3', {
          title: 'arglbargle',
          body: 'zimzamzoz'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
      }

      const trace = transaction.trace
      const createSegment = trace.root.children[0]
      const attributes = createSegment.getAttributes()

      t.equal(attributes.host, 'http://localhost:9200/', 'should have host as attribute')
      t.equal(
        attributes.port_path_or_id,
        String(params.elastic_port),
        'should have port as attribute'
      )
      // t.equal(attributes.database_name, String(DB_INDEX), 'should have database id as attribute')
      t.equal(attributes.database_name, 'unknown', 'should report "unknown" as database name')
      t.equal(attributes.product, 'ElasticSearch', 'should have product attribute')
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
        await db.createDocument(DB_INDEX, 'testkey5', {
          title: 'arglbargle',
          body: 'zimzamzoz'
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

  t.test('should follow selected database', async function (t) {
    t.plan(4)
    let transaction = null
    await db.createIndex(DB_INDEX_2)
    await helper.runInTransaction(agent, async function (tx) {
      transaction = tx
      try {
        await db.createDocument(DB_INDEX_2, 'select:test:key', {
          title: 'foo',
          body: 'bar'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
        if (!t.error(e)) {
          return t.end()
        }
      }

      t.ok(agent.getTransaction(), 'should not lose transaction state')

      try {
        await db.createDocument(DB_INDEX_2, 'select:test:key:2', {
          title: 'bar',
          body: 'baz'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
        if (!t.error(e)) {
          return t.end()
        }
      }

      t.ok(agent.getTransaction(), 'should not lose transaction state')
      transaction.end()
      verify(transaction)
    })

    function verify(transaction) {
      const createSegment1 = transaction?.trace?.root?.children?.[0]
      // const selectSegment = createSegment1?.children?.[0]?.children?.[0]
      const createSegment2 = transaction?.trace?.root?.children?.[1]
      console.log(`createSegment2`, createSegment2)
      t.equal(
        createSegment1.name,
        'Datastore/statement/ElasticSearch/test2/create',
        'should register the first create'
      )
      // t.equal(
      //   createSegment1.getAttributes().database_name,
      //   String(DB_INDEX),
      //   'should have the starting database id as attribute for the first set'
      // )
      t.equal(
        createSegment2.name,
        'Datastore/statement/ElasticSearch/test2/create',
        'should register the second create'
      )
      // t.equal(
      //   createSegment2.getAttributes().database_name,
      //   String(DB_INDEX_2),
      //   'should have the selected database id as attribute for the second create'
      // )
    }
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
