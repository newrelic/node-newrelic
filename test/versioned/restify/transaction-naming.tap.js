'use strict'

const helper = require('../../lib/agent_helper')
const tap = require('tap')

tap.test('Restify transaction naming', (t) => {
  t.autoend()

  let agent = null
  let restify = null
  let server = null

  t.beforeEach((done) => {
    agent = helper.instrumentMockedAgent()
    restify = require('restify')
    server = restify.createServer()
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    if (server) {
      server.close(done)
    } else {
      done()
    }
  })

  t.test('transaction name with single route', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      res.send()
      next()
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('transaction name with no matched routes', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      t.fail('should not enter different endpoint')
      res.send()
      next()
    })

    runTest(t, '/foobar', 'Nodejs', 'GET/(not found)', t.end)
  })

  t.test('transaction name with route that has multiple handlers', (t) => {
    t.plan(3)

    server.get('/path1', (req, res, next) => {
      t.pass('should enter first middleware')
      next()
    }, (req, res, next) => {
      t.pass('should enter second middleware')
      res.send()
      next()
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('transaction name with middleware', (t) => {
    t.plan(3)

    server.use((req, res, next) => {
      t.pass('should enter `use` middleware')
      next()
    })
    server.get('/path1', (req, res, next) => {
      t.pass('should enter route handler')
      res.send()
      next()
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('multiple route handlers with the same name do not duplicate', (t) => {
    t.plan(3)

    server.get({name: 'first', path: '/path1'}, (req, res, next) => {
      t.pass('should execute first handler')
      next('second')
    })

    server.get({name: 'second', path: '/path1'}, (req, res, next) => {
      t.pass('should execute second handler')
      res.send()
      next()
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('responding from middleware', (t) => {
    t.plan(2)

    server.use((req, res, next) => {
      res.send()
      next()
    })

    server.get('/path1', (req, res, next) => {
      t.pass('should enter route middleware')
      next()
    })

    runTest(t, '/path1', 'GET//', t.end)
  })

  t.test('with error', (t) => {
    t.plan(1)

    const errors = require('restify-errors')

    server.get('/path1', (req, res,  next) => {
      next(new errors.InternalServerError('foobar'))
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('with error while out of context', (t) => {
    t.plan(1)

    const errors = require('restify-errors')

    server.get('/path1', (req, res,  next) => {
      helper.runOutOfContext(() => {
        next(new errors.InternalServerError('foobar'))
      })
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('when using a route variable', (t) => {
    t.plan(2)

    server.get('/foo/:bar', (req, res, next) => {
      t.equal(req.params.bar, 'fizz', 'should pass through params')
      res.send()
      next()
    })

    runTest(t, '/foo/fizz', 'GET//foo/:bar', t.end)
  })

  t.test('when using a regular expression in path', (t) => {
    t.plan(2)

    server.get(/^\/foo\/(.*)/, (req, res, next) => {
      t.equal(req.params[0], 'bar', 'should pass through captured param')
      res.send()
      next()
    })

    runTest(t, '/foo/bar', 'GET//^\\/foo\\/(.*)/', t.end)
  })

  t.test('when next is called after transaction state loss', (t) => {
    t.plan(5)

    server.use((req, res, next) => {
      t.ok(agent.getTransaction(), 'should have transaction at start')
      req.testTx = agent.getTransaction()

      helper.runOutOfContext(() => {
        t.notOk(agent.getTransaction(), 'should lose transaction before next')
        next()
      })
    })

    server.get('/path1', (req, res, next) => {
      const tx = agent.getTransaction()
      t.ok(tx, 'should re-instate transaction in next middleware')
      t.equal(tx && tx.id, req.testTx.id, 'should reinstate correct transaction')
      res.send()
      next()
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('responding after transaction state loss', (t) => {
    t.plan(2)

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        t.notOk(agent.getTransaction(), 'should have no transaction')
        res.send()
        next()
      })
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('responding with just a status code', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      res.send(299)
      next()
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  t.test('responding with just a status code after state loss', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        res.send(299)
        next()
      })
    })

    runTest(t, '/path1', 'GET//path1', t.end)
  })

  function runTest(t, endpoint, prefix, expectedName, cb) {
    if (typeof expectedName === 'function') {
      // runTest(t, endpoint, expectedName, cb)
      cb = expectedName
      expectedName = prefix
      prefix = 'Restify'
    }

    expectedName = `WebTransaction/${prefix}/${expectedName}`
    agent.on('transactionFinished', (tx) => {
      t.equal(tx.name, expectedName, 'should have correct name')
      cb()
    })

    server.listen(() => {
      const port = server.address().port
      helper.makeGetRequest(`http://localhost:${port}${endpoint}`)
    })
  }
})
