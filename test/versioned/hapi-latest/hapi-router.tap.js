'use strict'

// the latest hapi versions are only compatible with versions of node >=4.5
var semver = require('semver')
if (semver.satisfies(process.version, '<4.5')) {
  console.log('Latest version\n# disabled because of incompatibility')
  console.log('ok 1 nothing to do\n\n1..1\n\n# ok')
  process.exit(0)
}

var path    = require('path')
var test    = require('tap').test
var request = require('request')
var helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))


function verifier(t, verb) {
  verb = verb || "GET"
  return function(transaction) {
    t.equal(transaction.name, 'WebTransaction/Hapi/' + verb + '//test/{id}',
            "transaction has expected name")
    t.equal(transaction.url, '/test/31337', "URL is left alone")
    t.equal(transaction.statusCode, 200, "status code is OK")
    t.equal(transaction.verb, verb, "HTTP method is " + verb)
    t.ok(transaction.trace, "transaction has trace")

    var web = transaction.trace.root.children[0]
    t.ok(web, "trace has web segment")
    t.equal(web.name, transaction.name, "segment name and transaction name match")
    t.equal(web.partialName, 'Hapi/' + verb + '//test/{id}',
            "should have partial name for apdex")
    t.equal(web.parameters.id, '31337', "namer gets parameters out of route")
  }
}

test("Hapi router introspection", function(t) {
  t.autoend()

  var agent = null
  var hapi = null
  var server = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    hapi = require('hapi')
    server = new hapi.Server()
    server.connection({port: 8089})

    // disabled by default
    agent.config.capture_params = true

    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    server.stop(done)
  })

  t.test("using route handler - simple case", function(t) {
    agent.on('transactionFinished', verifier(t))

    var route = {
      method : 'GET',
      path   : '/test/{id}',
      handler : function(request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")

        reply({status : 'ok'})
      }
    }
    server.route(route)

    server.start(function() {
      request.get('http://localhost:8089/test/31337',
                  {json : true},
                  function(error, res, body) {

        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected response")
        t.end()
      })
    })
  })

  t.test("using route handler under config object", function(t) {
    agent.on('transactionFinished', verifier(t))

    var hello = {
      handler : function(request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")

        reply({status : 'ok'})
      }
    }

    var route = {
      method : 'GET',
      path   : '/test/{id}',
      config : hello
    }
    server.route(route)

    server.start(function() {
      request.get('http://localhost:8089/test/31337',
                  {json : true},
                  function(error, res, body) {

        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected response")
        t.end()
      })
    })
  })

  t.test("using custom handler type", function(t) {
    agent.on('transactionFinished', verifier(t))

    server.handler('hello', function(route, options) {
      return function customHandler(request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")
        reply({status : 'ok'})
      }
    })

    var route = {
      method : 'GET',
      path   : '/test/{id}',
      handler: {
        hello: {}
      }
    }
    server.route(route)

    server.start(function() {
      request.get('http://localhost:8089/test/31337',
                  {json : true},
                  function(error, res, body) {

        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected response")
        t.end()
      })
    })
  })

  /*
   * This test covers the use case of placing defaults on the handler
   * function.
   * for example: https://github.com/hapijs/h2o2/blob/v6.0.1/lib/index.js#L189-L198
   */
  t.test("using custom handler defaults", function(t) {
    agent.on('transactionFinished', verifier(t, 'POST'))
    function handler(route, options) {
      t.equal(
        route.settings.payload.parse,
        false,
        'should set the payload parse setting'
      )

      t.equal(
        route.settings.payload.output,
        'stream',
        'should set the payload output setting'
      )

      return function customHandler(request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")
        reply({status : 'ok'})
      }
    }

    handler.defaults = {
      payload: {
        output: 'stream',
        parse: false
      }
    }

    server.handler('hello', handler)

    var route = {
      method : 'POST',
      path   : '/test/{id}',
      handler: {
        hello: {}
      }
    }
    server.route(route)

    server.start(function() {
      request.post(
        'http://localhost:8089/test/31337',
        {json : true},
        function(error, res, body) {
          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
          t.end()
        }
      )
    })
  })
})
