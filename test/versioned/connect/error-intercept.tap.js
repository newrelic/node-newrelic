'use strict'

var tap    = require('tap')
var test   = tap.test
var helper = require('../../lib/agent_helper')


// connect is a loudmouth without this
process.env.NODE_ENV = 'test'

test("intercepting errors with connect 2", function(t) {
  t.plan(3)

  t.test("should wrap handlers with proxies", function(t) {
    var agent = helper.instrumentMockedAgent()
    var connect = require('connect')
    var app = connect()


    t.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
    })

    function nop() {}

    app.use(nop)

    t.ok(app.stack, "there's a stack of handlers defined")
    // 2 because of the error handler
    t.equal(app.stack.length, 1, "have test middleware + error interceptor")

    var wrapNop = app.stack[0]
    t.equal(wrapNop.route, '', "nop handler defaults to all routes")
    t.ok(wrapNop.handle, "have nop handle passed above")
    t.equal(wrapNop.handle.name, 'nop', "nop's name is unchanged")
    t.equal(wrapNop.handle.__NR_original, nop, "nop is wrapped")

    t.end()
  })

  t.test("should have only one error interceptor in the middleware stack", function(t) {
    var agent   = helper.instrumentMockedAgent()
    var connect = require('connect')
    var app     = connect()


    t.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
    })

    app.use(function first() {})
    t.equal(app.stack.length, 1, "1 handlers after 1st add")

    app.use(function second() {})
    t.equal(app.stack.length, 2, "2 handlers after 2nd add")

    app.use(function third() {})
    t.equal(app.stack.length, 3, "3 handlers after 3rd add")

    app.use(function fourth() {})
    t.equal(app.stack.length, 4, "4 handlers after 4th add")

    t.end()
  })

  t.test("should trace errors that occur while executing a middleware", function(t) {
    var agent = helper.instrumentMockedAgent()
    var server
    agent.once('transactionFinished', function() {
      var errors = agent.errors.traceAggregator.errors // FIXME: redundancy is dumb
      t.equal(errors.length, 1, "the error got traced")

      var error = errors[0]
      t.equal(error.length, 5, "format for traced error is correct")
      t.equal(error[3], 'TypeError', "got the correct class for the error")

      server.close()
      t.end()
    })

    t.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
    })

    helper.runInTransaction(agent, function() {
      var connect = require('connect')
      var app = connect()

      function wiggleware(req, res, next) {
        var harbl = null
        harbl.bargl() // OHHH NOOOOO

        return next() // will never get here
      }

      var stubRes = {
        headers : {},
        setHeader : function(name, value) {
          stubRes.headers[name] = value
        },
        end : function() {
          stubRes._end = agent.tracer.slice(arguments)
        }
      }

      app.use(wiggleware)

      var http = require('http')
      server = http.createServer(function(req, res) {
        app.handle(req, res)
      }).listen(0, function() {
        var req = http.request({
          port: server.address().port,
          host: 'localhost',
          path: '/asdf',
          method: 'GET'
        }, function onResponse(res) {
          res.on('data', function() {
            // throw away the data
          })
        })
        req.end()
      })
    })
  })
})
