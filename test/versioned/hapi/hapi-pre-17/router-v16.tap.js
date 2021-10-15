/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const request = require('request')
const helper = require('../../../lib/agent_helper')
const utils = require('./hapi-utils')
const semver = require('semver')
const { version: pkgVersion } = require('hapi/package')

tap.test('Hapi router introspection', function (t) {
  t.autoend()

  let agent = null
  let server = null
  let port = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    server = utils.getServer()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return new Promise((resolve) => server.stop(resolve))
  })

  t.test('using route handler - simple case', function (t) {
    agent.on('transactionFinished', utils.verifier(t))

    const route = {
      method: 'GET',
      path: '/test/{id}',
      handler: function (req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({ status: 'ok' })
      }
    }
    server.route(route)

    server.start(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using route handler under config object', function (t) {
    agent.on('transactionFinished', utils.verifier(t))

    const hello = {
      handler: function (req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({ status: 'ok' })
      }
    }

    const route = {
      method: 'GET',
      path: '/test/{id}',
      config: hello
    }
    server.route(route)

    server.start(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using route handler outside of config object', function (t) {
    agent.on('transactionFinished', utils.verifier(t))

    const route = {
      method: 'GET',
      path: '/test/{id}',
      config: {},
      handler: function (req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({ status: 'ok' })
      }
    }
    server.route(route)

    server.start(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using `pre` config option', function (t) {
    agent.on('transactionFinished', utils.verifier(t))

    server.method('test', function (arg, next) {
      t.ok(agent.getTransaction(), 'transaction available in server method')
      next()
    })

    const route = {
      method: 'GET',
      path: '/test/{id}',
      config: {
        pre: [
          function plain(req, reply) {
            t.ok(agent.getTransaction(), 'transaction available in plain `pre` function')
            reply()
          },
          {
            method: 'test'
          },
          [
            {
              method: function nested(req, reply) {
                t.ok(agent.getTransaction(), 'transaction available in nested `pre` function')
                reply()
              }
            },
            {
              assign: 'pre3',
              method: function nested2(req, reply) {
                t.ok(agent.getTransaction(), 'transaction available in 2nd nested `pre` function')
                reply.response('ok')
              }
            }
          ]
        ],
        handler: function (req, reply) {
          t.ok(agent.getTransaction(), 'transaction is available in final handler')
          reply({ status: req.pre.pre3 })
        }
      }
    }
    server.route(route)

    server.start(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using custom handler type', function (t) {
    agent.on('transactionFinished', utils.verifier(t))

    server.handler('hello', function () {
      return function customHandler(req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({ status: 'ok' })
      }
    })

    const route = {
      method: 'GET',
      path: '/test/{id}',
      handler: {
        hello: {}
      }
    }
    server.route(route)

    server.start(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  /*
   * This test covers the use case of placing defaults on the handler
   * function.
   * for example: https://github.com/hapijs/h2o2/blob/v6.0.1/lib/index.js#L189-L198
   */
  t.test('using custom handler defaults', function (t) {
    agent.on('transactionFinished', utils.verifier(t, 'POST'))
    function handler(route) {
      t.equal(route.settings.payload.parse, false, 'should set the payload parse setting')

      t.equal(route.settings.payload.output, 'stream', 'should set the payload output setting')

      return function customHandler(req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({ status: 'ok' })
      }
    }

    handler.defaults = {
      payload: {
        output: 'stream',
        parse: false
      }
    }

    server.handler('hello', handler)

    const route = {
      method: 'POST',
      path: '/test/{id}',
      handler: {
        hello: {}
      }
    }
    server.route(route)

    server.start(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.post(params, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('404 transaction is named correctly', function (t) {
    agent.on('transactionFinished', function (tx) {
      t.equal(
        tx.trace.root.children[0].name,
        'WebTransaction/Nodejs/GET/(not found)',
        '404 segment has standardized name'
      )
    })

    server.start(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test',
        json: true
      }
      request.get(params, function (error, res, body) {
        t.equal(res.statusCode, 404, 'nonexistent route was not found')
        const expectedErr = semver.satisfies(pkgVersion, '>=16.2.0')
          ? { statusCode: 404, error: 'Not Found', message: 'Not Found' }
          : { statusCode: 404, error: 'Not Found' }
        t.same(body, expectedErr, 'got expected response')
        t.end()
      })
    })
  })
})
