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
// const { resolve } = require('jsdoc/lib/jsdoc/name')

const dbTools = (client) => {
  const createIndex = async (index) => {
    try {
      return await client.indices.create({
        index
      })
    } catch (error) {
      console.error(error)
    }
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

test('Elasticsearch instrumentation', { timeout: 20000 }, function (t) {
  t.autoend()

  let METRIC_HOST_NAME = null
  let HOST_ID = null
  const DB_INDEX = `test`
  const DB_INDEX_2 = `test2`

  let agent
  let client
  let db

  t.before(async () => {
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
  })

  t.beforeEach(async function () {
    agent = helper.instrumentMockedAgent()

    METRIC_HOST_NAME = urltils.isLocalhost(params.elastic_host)
      ? agent.config.getHostnameSafe()
      : params.elastic_host
    HOST_ID = METRIC_HOST_NAME + '/' + params.elastic_port

    // need to capture attributes
    agent.config.attributes.enabled = true

    // Start testing!
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
  })

  t.afterEach(function () {
    // client && client.end({ flush: false })
    agent && helper.unloadAgent(agent)
  })

  t.teardown(async () => {
    await client.indices.delete({ index: DB_INDEX })
    await client.indices.delete({ index: DB_INDEX_2 })
  })

  t.test('should find Elastic calls in the transaction trace', function (t) {
    // t.plan(17)
    helper.runInTransaction(agent, async function transactionInScope() {
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

      const value = await client.get({ id: 'testkey', index: DB_INDEX })
      t.ok(
        agent.getTransaction(),
        'transaction should still still be visible after getting a document'
      )
      t.hasProp(value, '_source', 'elastic value should have _source property')
      t.hasProp(value._source, 'title', 'elastic value._source should have the correct title')
      t.equal(value._source.title, 'arglbargle', 'elastic client should still work')

      const trace = transaction.trace
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist')

      // TODO: Failing here: currently no children
      t.equal(trace.root.children.length, 1, 'there should be only one child of the root')

      const setSegment = trace.root.children[0]
      const setAttributes = setSegment.getAttributes()
      t.ok(setSegment, 'trace segment for set should exist')
      t.equal(setSegment.name, 'Datastore/operation/Elastic/set', 'should register the set')
      t.equal(setAttributes.key, '"testkey"', 'should have the set key as a attribute')
      t.equal(setSegment.children.length, 1, 'set should have an only child')

      const getSegment = setSegment.children[0].children[0]
      const getAttributes = getSegment.getAttributes()
      t.ok(getSegment, 'trace segment for get should exist')

      t.equal(getSegment.name, 'Datastore/operation/Elastic/get', 'should register the get')

      t.equal(getAttributes.key, '"testkey"', 'should have the get key as a attribute')

      t.ok(getSegment.children.length >= 1, 'get should have a callback segment')

      t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
      // t.end()
    })
  })

  t.test('should create correct metrics', function (t) {
    // t.plan(14)
    helper.runInTransaction(agent, async function transactionInScope() {
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
        'Datastore/Elastic/all': 2,
        'Datastore/Elastic/allWeb': 2,
        'Datastore/operation/Elastic/create': 1,
        'Datastore/operation/Elastic/index': 1
      }
      expected['Datastore/instance/Elastic/' + HOST_ID] = 2
      checkMetrics(t, unscoped, expected)
      // t.end()
    })
  })

  t.test('should add `key` attribute to trace segment', function (t) {
    agent.config.attributes.enabled = true

    helper.runInTransaction(agent, async function () {
      try {
        await db.createDocument(DB_INDEX, 'saveme2', {
          title: 'foobar2',
          body: 'bazbap2'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
      }

      const segment = agent.tracer.getSegment().parent
      t.equal(segment.getAttributes().key, '"saveme2"', 'should have `key` attribute')
      t.end()
    })
  })

  t.test('should not add `key` attribute to trace segment', function (t) {
    agent.config.attributes.enabled = false

    helper.runInTransaction(agent, async function () {
      try {
        await db.createDocument(DB_INDEX, 'testkey', {
          title: 'arglbargle',
          body: 'zimzamzoz'
        })
      } catch (e) {
        t.notOk(e, 'Create document should not error')
      }
      const segment = agent.tracer.getSegment().parent
      t.notOk(segment.getAttributes().key, 'should not have `key` attribute')
      t.end()
    })
  })

  t.test('should add datastore instance attributes to trace segments', function (t) {
    t.plan(4)

    // Enable.
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    helper.runInTransaction(agent, async function transactionInScope() {
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
      const setSegment = trace.root.children[0]
      const attributes = setSegment.getAttributes()
      t.equal(attributes.host, METRIC_HOST_NAME, 'should have host as attribute')
      t.equal(
        attributes.port_path_or_id,
        String(params.elastic_port),
        'should have port as attribute'
      )
      t.equal(attributes.database_name, String(DB_INDEX), 'should have database id as attribute')
      t.equal(attributes.product, 'Elastic', 'should have product attribute')
    })
  })

  t.test('should not add instance attributes/metrics when disabled', function (t) {
    t.plan(5)

    // disable
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    helper.runInTransaction(agent, async function transactionInScope() {
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

      const setSegment = transaction.trace.root.children[0]
      const attributes = setSegment.getAttributes()
      t.equal(attributes.host, undefined, 'should not have host attribute')
      t.equal(attributes.port_path_or_id, undefined, 'should not have port attribute')
      t.equal(attributes.database_name, undefined, 'should not have db name attribute')

      transaction.end()
      const unscoped = transaction.metrics.unscoped
      t.equal(
        unscoped['Datastore/instance/Redis/' + HOST_ID],
        undefined,
        'should not have instance metric'
      )
    })
  })

  t.test('should follow selected database', async function (t) {
    t.plan(12)
    let transaction = null
    await db.createIndex(DB_INDEX_2)

    helper.runInTransaction(agent, async function (tx) {
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
      verify()
    })

    function verify() {
      const setSegment1 = transaction.trace.root.children[0]
      const selectSegment = setSegment1.children[0].children[0]
      const setSegment2 = selectSegment.children[0].children[0]

      t.equal(setSegment1.name, 'Datastore/operation/Redis/set', 'should register the first set')
      t.equal(
        setSegment1.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the first set'
      )
      t.equal(
        selectSegment.name,
        'Datastore/operation/Elastic/select',
        'should register the select'
      )
      t.equal(
        selectSegment.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the select'
      )
      t.equal(setSegment2.name, 'Datastore/operation/Elastic/set', 'should register the second set')
      t.equal(
        setSegment2.getAttributes().database_name,
        String(DB_INDEX_2),
        'should have the selected database id as attribute for the second set'
      )
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
