'use strict'

var test = require('tap').test
var semver = require('semver')
var zlib = require('zlib')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')
var CONTENT = 'some content'
var DEFLATED_CONTENT = 'eJwrzs9NVUjOzytJzSsBAB7IBNA='
var DEFLATED_RAW = 'K87PTVVIzs8rSc0rAQA='
var GZIP_CONTENT = 'H4sIAAAAAAAAAyvOz01VSM7PK0nNKwEAPzEfQwwAAAA='
var concat = require('concat-stream')

test('deflate', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    zlib.deflate(CONTENT, function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('base64'), DEFLATED_CONTENT)
      verifySegments(t, agent, 'zlib.deflate')
    })
  })
})

test('deflateRaw', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    zlib.deflateRaw(CONTENT, function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('base64'), DEFLATED_RAW)
      verifySegments(t, agent, 'zlib.deflateRaw')
    })
  })
})

test('gzip', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    zlib.gzip(CONTENT, function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('base64'), GZIP_CONTENT)
      verifySegments(t, agent, 'zlib.gzip')
    })
  })
})

test('inflate', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    zlib.inflate(new Buffer(DEFLATED_CONTENT, 'base64'), function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.inflate')
    })
  })
})

test('inflateRaw', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    zlib.inflateRaw(new Buffer(DEFLATED_RAW, 'base64'), function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.inflateRaw')
    })
  })
})

test('gunzip', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    zlib.gunzip(new Buffer(GZIP_CONTENT, 'base64'), function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.gunzip')
    })
  })
})

test('unzip', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    zlib.unzip(new Buffer(GZIP_CONTENT, 'base64'), function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.unzip')
    })
  })
})

// there is an incompatibility between the streams 1 and streams 2 that
// breaks our instrumentation. This is tracked in issue #577.
// TODO: break this incompatibility out into its own test when it comes
// time to fix the instrumentation
test('createGzip', {skip: semver.satisfies(process.version, "<0.10")}, function(t) {
  testStream(t, 'createGzip', CONTENT, GZIP_CONTENT)
})

test('createGunzip', {skip: semver.satisfies(process.version, "<0.10")}, function(t) {
  testStream(
    t,
    'createGunzip',
    new Buffer(GZIP_CONTENT, 'base64'),
    new Buffer(CONTENT).toString('base64')
  )
})

test('createUnzip', {skip: semver.satisfies(process.version, "<0.10")}, function(t) {
  testStream(
    t,
    'createUnzip',
    new Buffer(GZIP_CONTENT, 'base64'),
    new Buffer(CONTENT).toString('base64')
  )
})

test('createDeflate', {skip: semver.satisfies(process.version, "<0.10")}, function(t) {
  testStream(t, 'createDeflate', CONTENT, DEFLATED_CONTENT)
})

test('createInflate', {skip: semver.satisfies(process.version, "<0.10")}, function(t) {
  testStream(
    t,
    'createInflate',
    new Buffer(DEFLATED_CONTENT, 'base64'),
    new Buffer(CONTENT).toString('base64')
  )
})

test('createDeflateRaw', {skip: semver.satisfies(process.version, "<0.10")}, function(t) {
  testStream(t, 'createDeflateRaw', CONTENT, DEFLATED_RAW)
})

test('createInflateRaw', {skip: semver.satisfies(process.version, "<0.10")}, function(t) {
  testStream(
    t,
    'createInflateRaw',
    new Buffer(DEFLATED_RAW, 'base64'),
    new Buffer(CONTENT).toString('base64')
  )
})

function testStream(t, method, src, out) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(transaction) {
    var stream = zlib[method]()
    stream.pipe(concat(check))
    stream.end(src)

    function check(result) {
      t.equal(result.toString('base64'), out, 'should have correct result')
      t.equal(agent.getTransaction(), transaction)
      t.end()
    }
  })
}

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
