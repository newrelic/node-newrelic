/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const mongoPackage = require('mongodb/package.json')
const params = require('../../lib/params')
const semver = require('semver')
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

// Check package versions to decide which connect function to use below
exports.connect = function connect() {
  if (semver.satisfies(mongoPackage.version, '<3')) {
    return connectV2.apply(this, arguments)
  } else if (semver.satisfies(mongoPackage.version, '>=3 <4.2.0')) {
    return connectV3.apply(this, arguments)
  }
  return connectV4.apply(this, arguments)
}

exports.close = function close() {
  if (semver.satisfies(mongoPackage.version, '<4')) {
    return closeLegacy.apply(this, arguments)
  }
  return closeAsync.apply(this, arguments)
}

exports.checkMetrics = checkMetrics
exports.getHostName = getHostName
exports.getPort = getPort

function connectV2(mongodb, path) {
  return new Promise((resolve, reject) => {
    let server = null
    if (path) {
      server = new mongodb.Server(path)
    } else {
      server = new mongodb.Server(params.mongodb_host, params.mongodb_port, {
        socketOptions: {
          connectionTimeoutMS: 30000,
          socketTimeoutMS: 30000
        }
      })
    }

    const db = new mongodb.Db(DB_NAME, server)

    db.open(function (err) {
      if (err) {
        reject(err)
      }

      resolve({ db, client: null })
    })
  })
}

function connectV3(mongodb, host, replicaSet = false) {
  return new Promise((resolve, reject) => {
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
    mongodb.MongoClient.connect(connString, options, function (err, client) {
      if (err) {
        reject(err)
      }

      const db = client.db(DB_NAME)
      resolve({ db, client })
    })
  })
}

// This is same as connectV3 except it uses a different
// set of params to connect to the mongodb_v4 container
// it is actually just using the `mongodb:5` image
async function connectV4(mongodb, host, replicaSet = false) {
  if (host) {
    host = encodeURIComponent(host)
  } else {
    host = params.mongodb_v4_host + ':' + params.mongodb_v4_port
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

function closeLegacy(client, db) {
  return new Promise((resolve) => {
    if (db && typeof db.close === 'function') {
      db.close(resolve)
    } else if (client) {
      client.close(true, resolve)
    } else {
      resolve()
    }
  })
}

async function closeAsync(client, db) {
  if (db && typeof db.close === 'function') {
    await db.close()
  } else if (client) {
    await client.close(true)
  }
}

function getHostName(agent) {
  const host = semver.satisfies(mongoPackage.version, '>=4.2.0')
    ? params.mongodb_v4_host
    : params.mongodb_host
  return urltils.isLocalhost(host) ? agent.config.getHostnameSafe() : host
}

function getPort() {
  return semver.satisfies(mongoPackage.version, '>=4.2.0')
    ? String(params.mongodb_v4_port)
    : String(params.mongodb_port)
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
