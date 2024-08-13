/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

const MONGO_SEGMENT_RE = /^Datastore\/.*?\/MongoDB/
const TRANSACTION_NAME = 'mongo test'
const DB_NAME = 'integration'
const COLLECTIONS = { collection1: 'testCollection', collection2: 'testCollection2' }
const STATEMENT_PREFIX = `Datastore/statement/MongoDB/${COLLECTIONS.collection1}`
const ESM = {
  DB_NAME: 'esmIntegration',
  COLLECTIONS: { collection1: 'esmTestCollection', collection2: 'esmTestCollection2' },
  STATEMENT_PREFIX: 'Datastore/statement/MongoDB/esmTestCollection'
}
exports.ESM = ESM

exports.MONGO_SEGMENT_RE = MONGO_SEGMENT_RE
exports.TRANSACTION_NAME = TRANSACTION_NAME
exports.DB_NAME = DB_NAME
exports.COLLECTIONS = COLLECTIONS
exports.STATEMENT_PREFIX = STATEMENT_PREFIX

exports.connect = connect
exports.close = close
exports.checkMetrics = checkMetrics
exports.getHostName = getHostName
exports.getPort = getPort

async function connect({ mongodb, host, replicaSet = false, name = DB_NAME }) {
  if (host) {
    host = encodeURIComponent(host)
  } else {
    host = params.mongodb_host + ':' + params.mongodb_port
  }

  let connString = `mongodb://${host}`
  let options = {}

  if (replicaSet) {
    connString = `mongodb://${host},${host},${host}`
    options = { useNewUrlParser: true, useUnifiedTopology: true }
  }
  const client = await mongodb.MongoClient.connect(connString, options)
  const db = client.db(name)
  return { db, client }
}

async function close(client, db) {
  if (db && typeof db.close === 'function') {
    await db.close()
  } else if (client) {
    await client.close(true)
  }
}

function getHostName(agent) {
  const host = params.mongodb_host
  return urltils.isLocalhost(host) ? agent.config.getHostnameSafe() : host
}

function getPort() {
  return String(params.mongodb_port)
}

function checkMetrics({ t, agent, host, port, metrics = [], prefix = STATEMENT_PREFIX }) {
  const agentMetrics = getMetrics(agent)

  const unscopedMetrics = agentMetrics.unscoped
  const unscopedDatastoreNames = Object.keys(unscopedMetrics).filter((input) => {
    return input.includes('Datastore')
  })

  const scoped = agentMetrics.scoped[TRANSACTION_NAME]
  let total = 0

  if (!t.ok(scoped, 'should have scoped metrics')) {
    return
  }
  t.equal(Object.keys(agentMetrics.scoped).length, 1, 'should have one metric scope')
  for (let i = 0; i < metrics.length; ++i) {
    let count = null
    let name = null

    if (Array.isArray(metrics[i])) {
      count = metrics[i][1]
      name = metrics[i][0]
    } else {
      count = 1
      name = metrics[i]
    }

    total += count

    t.equal(
      unscopedMetrics['Datastore/operation/MongoDB/' + name].callCount,
      count,
      'unscoped operation metric should be called ' + count + ' times'
    )
    t.equal(
      unscopedMetrics[`${prefix}/` + name].callCount,
      count,
      'unscoped statement metric should be called ' + count + ' times'
    )
    t.equal(
      scoped[`${prefix}/` + name].callCount,
      count,
      'scoped statement metric should be called ' + count + ' times'
    )
  }

  let expectedUnscopedCount = 5 + 2 * metrics.length
  if (agent.config.security.agent.enabled) {
    // The security agent adds a `Supportability/API/instrumentDatastore` metric
    // via `API.prototype.instrumentDatastore`.
    expectedUnscopedCount += 1
  }
  t.equal(
    unscopedDatastoreNames.length,
    expectedUnscopedCount,
    'should have ' + expectedUnscopedCount + ' unscoped metrics'
  )
  const expectedUnscopedMetrics = [
    'Datastore/all',
    'Datastore/allWeb',
    'Datastore/MongoDB/all',
    'Datastore/MongoDB/allWeb',
    'Datastore/instance/MongoDB/' + host + '/' + port
  ]
  expectedUnscopedMetrics.forEach(function (metric) {
    if (t.ok(unscopedMetrics[metric], 'should have unscoped metric ' + metric)) {
      t.equal(unscopedMetrics[metric].callCount, total, 'should have correct call count')
    }
  })
}

function getMetrics(agent) {
  return agent.metrics._metrics
}
