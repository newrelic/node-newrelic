'use strict'

var fs = require('fs')
var mongoPackage = require('mongodb/package.json')
var params = require('../../lib/params')
var semver = require('semver')
var urltils = require('../../../lib/util/urltils')

var MONGO_SEGMENT_RE = /^Datastore\/.*?\/MongoDB/
var TRANSACTION_NAME = 'mongo test'
var DB_NAME = 'integration'


exports.MONGO_SEGMENT_RE = MONGO_SEGMENT_RE
exports.TRANSACTION_NAME = TRANSACTION_NAME
exports.DB_NAME = DB_NAME

exports.connect = semver.satisfies(mongoPackage.version, '<3')
  ? connectV2
  : connectV3

exports.checkMetrics = checkMetrics
exports.close = close
exports.getHostName = getHostName
exports.getPort = getPort
exports.getDomainSocketPath = getDomainSocketPath

function connectV2(mongodb, path, cb) {
  var server = null
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

  var db = new mongodb.Db(DB_NAME, server)

  db.open(function(err) {
    cb(err, {db: db, client: null})
  })
}

function connectV3(mongodb, host, cb) {
  if (host) {
    host = encodeURIComponent(host)
  } else {
    host = params.mongodb_host + ':' + params.mongodb_port
  }
  mongodb.MongoClient.connect('mongodb://' + host, function(err, client) {
    if (err) {
      return cb(err)
    }

    var db = client.db(DB_NAME)
    cb(null, {db: db, client: client})
  })
}

function close(client, db, cb) {
  if (db && typeof db.close === 'function') {
    db.close(cb)
  } else if (client) {
    client.close(true, cb)
  } else {
    cb()
  }
}

function getHostName(agent) {
  return urltils.isLocalhost(params.mongodb_host)
    ? agent.config.getHostnameSafe()
    : params.mongodb_host
}

function getPort() {
  return String(params.mongodb_port)
}

function checkMetrics(t, agent, host, port, metrics) {
  const agentMetrics = getMetrics(agent)

  var unscopedMetrics = agentMetrics.unscoped
  var unscopedDatastoreNames = Object.keys(unscopedMetrics).filter((input) => {
    return input.includes('Datastore')
  })

  var scoped = agentMetrics.scoped[TRANSACTION_NAME]
  var total = 0

  if (!t.ok(scoped, 'should have scoped metrics')) {
    return
  }
  t.equal(Object.keys(agentMetrics.scoped).length, 1, 'should have one metric scope')
  for (var i = 0; i < metrics.length; ++i) {
    var count = null
    var name = null

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
      unscopedMetrics['Datastore/statement/MongoDB/testCollection/' + name].callCount,
      count,
      'unscoped statement metric should be called ' + count + ' times'
    )
    t.equal(
      scoped['Datastore/statement/MongoDB/testCollection/' + name].callCount,
      count,
      'scoped statement metric should be called ' + count + ' times'
    )
  }

  var expectedUnscopedCount = 5 + (2 * metrics.length)
  t.equal(
    unscopedDatastoreNames.length, expectedUnscopedCount,
    'should have ' + expectedUnscopedCount + ' unscoped metrics'
  )
  var expectedUnscopedMetrics = [
    'Datastore/all',
    'Datastore/allWeb',
    'Datastore/MongoDB/all',
    'Datastore/MongoDB/allWeb',
    'Datastore/instance/MongoDB/' + host + '/' + port
  ]
  expectedUnscopedMetrics.forEach(function(metric) {
    if (t.ok(unscopedMetrics[metric], 'should have unscoped metric ' + metric)) {
      t.equal(unscopedMetrics[metric].callCount, total, 'should have correct call count')
    }
  })
}

function getDomainSocketPath() {
  var files = fs.readdirSync('/tmp')
  for (var i = 0; i < files.length; ++i) {
    var file = '/tmp/' + files[i]
    if (/^\/tmp\/mongodb.*?\.sock$/.test(file)) {
      return file
    }
  }
  return null
}

function getMetrics(agent) {
  return agent.metrics._metrics
}
