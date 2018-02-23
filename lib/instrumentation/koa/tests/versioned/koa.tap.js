'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')
var http = require('http')

utils(tap)

tap.test('Koa instrumentation', function(t) {
  var helper = null
  var app = null
  var server = null

  t.beforeEach(function(done) {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'koa',
      type: 'web-framework',
      onRequire: require('../../lib/instrumentation')
    })
    var Koa = require('koa')
    app = new Koa()
    done()
  })

  t.afterEach(function(done) {
    server.close()
    app = null
    helper && helper.unload()
    done()
  })

  t.test('produces transaction trace with multiple middleware', function(t) {
    app.use(function one(ctx, next) {
      return next()
    })
    app.use(function two(ctx, next) {
      return next()
    })
    app.use(function three(ctx, next) {
      next()
    })

    helper.agent.on('transactionFinished', function(tx) {
      checkMiddlewareSegments(t, tx)
    })

    run()
  })

  t.test('correctly records actions interspersed among middleware', function(t) {
    helper.agent.config.allow_all_headers = true
    app.use(function one(ctx, next) {
      helper.agent.tracer.createSegment('testSegment')
      return next().then(function() {
        helper.agent.tracer.createSegment('nestedSegment')
        ctx.set('X-Response-Time', '1ms')
      })
    })
    app.use(function two(ctx, next) {
      return new Promise(function(resolve) {
        setTimeout(resolve, 10)
      })
      .then(next)
    })
    app.use(function three(ctx) {
      ctx.body = 'done'
    })

    helper.agent.on('transactionFinished', function(tx) {
      var trace = tx.trace.root.children[0]
      var attributes = tx.trace.attributes.attributes
      t.ok(
        attributes['response.headers.xResponseTime'],
        'collected expected response header'
      )
      var mid1 = trace.children[0]
      t.equal(
        mid1.name,
        'Nodejs/Middleware/Koa/one',
        '1st middleware segment has expected name'
      )
      var children = mid1.children
      t.equal(children[0].name, 'Truncated/testSegment', 'trace has 1st test segment')
      var mid2 = children[1]
      t.equal(
        mid2.name,
        'Nodejs/Middleware/Koa/two',
        '2nd middleware segment has expected name'
      )
      t.equal(children[2].name, 'Truncated/nestedSegment')
      children = mid2.children
      t.equal(children[0].name, 'timers.setTimeout', 'trace has 2nd test segment')
      var mid3 = children[1]
      t.equal(
        mid3.name,
        'Nodejs/Middleware/Koa/three',
        '3rd middleware segment has expected name'
      )
      t.end()
    })

    run()
  })

  t.test('maintains transaction state between middleware', function(t) {
    var tasks = []
    var intervalId = setInterval(function() {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.tearDown(function() {
      clearInterval(intervalId)
    })
    var tx

    app.use(function one(ctx, next) {
      tx = helper.agent.getTransaction()
      return new Promise(executor)

      function executor(resolve) {
        tasks.push(function() {
          next().then(function() {
            t.transaction(tx)
            resolve()
          })
        })
      }
    })
    app.use(function two(ctx, next) {
      t.transaction(tx)
      return next()
    })
    app.use(function three(ctx) {
      ctx.body = 'done'
    })

    helper.agent.on('transactionFinished', function(txn) {
      checkMiddlewareSegments(t, txn)
    })

    run()
  })

  t.test('errors handled within middleware are not recorded', function(t) {
    app.use(function one(ctx, next) {
      return next().catch(function(err) {
        t.equal(err.message, 'middleware error', 'caught expected error')
      })
    })
    app.use(function two() {
      throw new Error('middleware error')
    })

    helper.agent.on('transactionFinished', function(tx) {
      var errors = helper.agent.errors.errors
      t.equal(errors.length, 0, 'no errors are recorded')
      checkMiddlewareSegments(t, tx)
    })

    run()
  })

  t.test('errors not handled in middleware are recorded', function(t) {
    app.use(function one(ctx, next) {
      return next()
    })
    app.use(function two() {
      throw new Error('middleware error')
    })
    app.on('error', function(err) {
      t.equal(err.message, 'middleware error', 'caught expected error')
    })

    helper.agent.on('transactionFinished', function(tx) {
      var errors = helper.agent.errors.errors
      t.equal(errors.length, 1, 'recorded expected number of errors')
      var error = errors[0][2]
      t.equal(error, 'middleware error', 'recorded expected error')
      checkMiddlewareSegments(t, tx)
    })
    run()
  })

  t.autoend()

  function run() {
    server = app.listen(0, function() {
      http.get({port: server.address().port}).end()
    })
  }
})

function checkMiddlewareSegments(t, tx) {
  var trace = tx.trace.root.children[0]
  var mid1 = trace.children[0]
  t.equal(
    mid1.name,
    'Nodejs/Middleware/Koa/one',
    '1st middleware segment has expected name'
  )
  var mid2 = mid1.children[0]
  t.equal(
    mid2.name,
    'Nodejs/Middleware/Koa/two',
    '2nd middleware segment has expected name'
  )
  if (mid2.children[0]) {
    var mid3 = mid2.children[0]
    t.equal(
      mid3.name,
      'Nodejs/Middleware/Koa/three',
      '3rd middleware segment has expected name'
    )
  }
  t.end()
}
