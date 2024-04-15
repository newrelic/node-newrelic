/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const test = require('tap').test

const helper = require('../../lib/agent_helper')
const HTTP_ATTS = require('../../lib/fixtures').httpAttributes

test('Restify capture params introspection', function (t) {
  t.autoend()

  let agent = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent({
      allow_all_headers: false,
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
  })

  t.test('simple case with no params', function (t) {
    const server = require('restify').createServer()
    let port = null

    t.teardown(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      HTTP_ATTS.forEach(function (key) {
        t.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
      })
      if (attributes.httpResponseMessage) {
        t.equal(attributes.httpResponseMessage, 'OK', 'Trace contains httpResponseMessage')
      }
    })

    server.get('/test', function (req, res, next) {
      t.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      helper.makeGetRequest('http://localhost:' + port + '/test', function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('case with route params', function (t) {
    const server = require('restify').createServer()
    let port = null

    t.teardown(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(
        attributes['request.parameters.route.id'],
        '1337',
        'Trace attributes include `id` route param'
      )
    })

    server.get('/test/:id', function (req, res, next) {
      t.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      helper.makeGetRequest('http://localhost:' + port + '/test/1337', function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected respose')
        t.end()
      })
    })
  })

  t.test('case with query params', function (t) {
    const server = require('restify').createServer()
    let port = null

    t.teardown(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(
        attributes['request.parameters.name'],
        'restify',
        'Trace attributes include `name` query param'
      )
    })

    server.get('/test', function (req, res, next) {
      t.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      const url = 'http://localhost:' + port + '/test?name=restify'
      helper.makeGetRequest(url, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected respose')
        t.end()
      })
    })
  })

  t.test('case with both route and query params', function (t) {
    const server = require('restify').createServer()
    let port = null

    t.teardown(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(
        attributes['request.parameters.route.id'],
        '1337',
        'Trace attributes include `id` route param'
      )
      t.equal(
        attributes['request.parameters.name'],
        'restify',
        'Trace attributes include `name` query param'
      )
    })

    server.get('/test/:id', function (req, res, next) {
      t.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      const url = 'http://localhost:' + port + '/test/1337?name=restify'
      helper.makeGetRequest(url, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected respose')
        t.end()
      })
    })
  })
})
