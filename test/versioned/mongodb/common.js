/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const mongoPackage = require('mongodb/package.json')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

const MONGO_SEGMENT_RE = /^Datastore\/.*?\/MongoDB/
const TRANSACTION_NAME = 'mongo test'
const DB_NAME = 'integration'
const COLLECTIONS = { collection1: 'testCollection', collection2: 'testCollection2' }
const STATEMENT_PREFIX = `Datastore/statement/MongoDB/${COLLECTIONS.collection1}`

exports.MONGO_SEGMENT_RE = MONGO_SEGMENT_RE
exports.TRANSACTION_NAME = TRANSACTION_NAME
exports.DB_NAME = DB_NAME
exports.COLLECTIONS = COLLECTIONS
exports.STATEMENT_PREFIX = STATEMENT_PREFIX
exports.pkgVersion = mongoPackage.version

exports.connect = connect
exports.close = close
exports.checkMetrics = checkMetrics
exports.getHostName = getHostName
exports.getPort = getPort

async function connect(mongodb, host, replicaSet = false) {
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
  const db = client.db(DB_NAME)
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

function checkMetrics(t, agent, host, port, metrics) {
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
      unscopedMetrics[`${STATEMENT_PREFIX}/` + name].callCount,
      count,
      'unscoped statement metric should be called ' + count + ' times'
    )
    t.equal(
      scoped[`${STATEMENT_PREFIX}/` + name].callCount,
      count,
      'scoped statement metric should be called ' + count + ' times'
    )
  }

  let expectedUnscopedCount = 5 + 2 * metrics.length
  // adds a supportability metric to load k2 mongodb instrumentation
  if (agent.config.security.agent.enabled) {
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
