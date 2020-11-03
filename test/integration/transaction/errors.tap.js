/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var API = require('../../../api')
var util = require('util')

test('errors in web transactions should gather the query params', function(t) {
  t.plan(9)

  const agent = helper.loadTestAgent(t)
  const api = new API(agent)
  const http = require('http')

  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  http.createServer(function(req, res) {
    req.resume()
    api.noticeError(new Error('errors in tx test'))
    res.end('success')
  }).listen(function() {
    var server = this
    var url = 'http://localhost:' + server.address().port + '/?some=param&data'
    http.get(url, function(res) {
      t.equal(res.statusCode, 200, 'request should be successful')
      res.resume()
      server.close()
    })
  })

  agent.on('transactionFinished', function() {
    var error = agent.errors.traceAggregator.errors[0]
    t.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')
    t.equal(error[2], 'errors in tx test', 'should have gathered the errors message')
    t.equal(error[3], 'Error', 'should have gathered the type of the error')

    var attributes = error[4]
    // top level attributes
    t.ok(util.isArray(attributes.stack_trace), 'should be an array')

    // custom attributes
    t.equal(
      Object.keys(attributes.userAttributes).length,
      0,
      'should have no custom attributes'
    )

    t.equal(
      Object.keys(attributes.agentAttributes).length,
      9,
      'should have collected the query, request, and response params'
    )
    t.equal(
      attributes.agentAttributes['request.parameters.some'],
      'param',
      'should have collected a query param with a value'
    )
    t.equal(
      attributes.agentAttributes['request.parameters.data'],
      true,
      'should have collected a query param without a value'
    )
  })
})

test('multiple errors in web transactions should gather the query params', function(t) {
  t.plan(17)

  const agent = helper.loadTestAgent(t)
  const api = new API(agent)
  const http = require('http')

  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  var names = [
    'first errors in tx test',
    'second errors in tx test'
  ]

  http.createServer(function(req, res) {
    req.resume()
    api.noticeError(new Error(names[0]))
    api.noticeError(new Error(names[1]))
    res.end('success')
  }).listen(function() {
    var server = this
    var url = 'http://localhost:' + server.address().port + '/testing'
    url += '?some=param&data'
    http.get(url, function(res) {
      t.equal(res.statusCode, 200, 'request should be successful')
      res.resume()
      server.close()
    })
  })

  agent.on('transactionFinished', function() {
    agent.errors.traceAggregator.errors.forEach(function(error) {
      t.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')

      t.notEqual(names.indexOf(error[2]), -1, 'should have gathered the errors message')
      // Remove the found name from the list of names. Since they are unique and
      // should only appear on one error.
      names.splice(names.indexOf(error[2]), 1)
      t.equal(error[3], 'Error', 'should have gathered the type of the error')

      var attributes = error[4]
      // top level attributes
      t.ok(util.isArray(attributes.stack_trace), 'should be an array')

      // custom attributes
      t.equal(
        Object.keys(attributes.userAttributes).length,
        0,
        'should have no custom attributes'
      )

      t.equal(
        Object.keys(attributes.agentAttributes).length,
        9,
        'should have collected the query, request, and response params'
      )
      t.equal(
        attributes.agentAttributes['request.parameters.some'],
        'param',
        'should have collected a query param with a value'
      )
      t.equal(
        attributes.agentAttributes['request.parameters.data'],
        true,
        'should have collected a query param without a value'
      )
    })
  })
})

test('errors in web transactions should gather and merge custom params', function(t) {
  t.plan(12)

  const agent = helper.loadTestAgent(t)
  const api = new API(agent)
  const http = require('http')

  agent.config.attributes.enabled = true

  http.createServer(function(req, res) {
    req.resume()

    api.addCustomAttribute('preErrorKeep', true)
    api.addCustomAttribute('preErrorReplace', 'nooooooooo')

    api.noticeError(new Error('errors in tx test'), {
      preErrorReplace: 'yesssssssss',
      thisOneIsUnique: 1987,
      postErrorReplace: 'this one is better'
    })

    api.addCustomAttribute('postErrorKeep', 2)
    api.addCustomAttribute('postErrorReplace', 'omg why')

    res.end('success')
  }).listen(function() {
    var server = this
    var url = 'http://localhost:' + server.address().port + '/'
    http.get(url, function(res) {
      t.equal(res.statusCode, 200, 'request should be successful')
      res.resume()
      server.close()
    })
  })

  agent.on('transactionFinished', function() {
    var error = agent.errors.traceAggregator.errors[0]
    t.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')
    t.equal(error[2], 'errors in tx test', 'should have gathered the errors message')
    t.equal(error[3], 'Error', 'should have gathered the type of the error')

    var attributes = error[4]
    // top level attributes
    t.ok(util.isArray(attributes.stack_trace), 'should be an array')

    // custom attributes
    var ua = attributes.userAttributes
    t.equal(
      Object.keys(ua).length,
      5,
      'should have 5 custom attributes after merging'
    )
    t.equal(ua.preErrorKeep, true, 'kept custom param from before error')
    t.equal(ua.preErrorReplace, 'yesssssssss', 'replace custom param from before error')
    t.equal(ua.thisOneIsUnique, 1987, 'custom param that is not overriding also was kept')
    t.equal(ua.postErrorKeep, 2, 'kept custom param from after error')
    t.equal(
      ua.postErrorReplace,
      'this one is better',
      'replace custom param from after error'
    )

    t.equal(
      Object.keys(attributes.agentAttributes).length,
      7,
      'should have collected the query, request, and response params'
    )
  })
})

test('multiple errors in web tx should gather and merge custom params', function(t) {
  t.plan(21)

  const agent = helper.loadTestAgent(t)
  const api = new API(agent)
  const http = require('http')

  agent.config.attributes.enabled = true

  var errorData = [{
    name: 'first error indexOf tx test',
    customParams: {
      preErrorReplace: 'yesssss',
      thisOneIsUnique: 1987,
      postErrorReplace: 'this one is better'
    }
  }, {
    name: 'second error in tx test',
    customParams: {
      preErrorReplace: 'affirmative',
      thisOneIsUniqueToo: 1776,
      postErrorReplace: 'no, this one is better'
    }
  }]

  http.createServer(function(req, res) {
    req.resume()

    api.addCustomAttribute('preErrorKeep', true)
    api.addCustomAttribute('preErrorReplace', 'nooooooooo')

    api.noticeError(new Error(errorData[0].name), errorData[0].customParams)

    api.addCustomAttribute('postErrorKeep', 2)
    api.addCustomAttribute('postErrorReplace', 'omg why')

    api.noticeError(new Error(errorData[1].name), errorData[1].customParams)

    res.end('success')
  }).listen(function() {
    var server = this
    var url = 'http://localhost:' + server.address().port + '/'
    http.get(url, function(res) {
      t.equal(res.statusCode, 200, 'request should be successful')
      res.resume()
      server.close()
    })
  })

  agent.on('transactionFinished', function() {
    agent.errors.traceAggregator.errors.forEach(function(error) {
      var expectedParams
      if (errorData[0].name && errorData[0].name === error[2]) {
        expectedParams = errorData[0].customParams
        errorData[0] = {} // empty it out so it cant be found again
      } else if (errorData[1].name && errorData[1].name === error[2]) {
        expectedParams = errorData[1].customParams
        errorData[1] = {} // empty it out so it cant be found again
      } else {
        t.fail('could not find error data for: ' + JSON.stringify(error))
        return
      }

      t.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')
      t.equal(error[3], 'Error', 'should have gathered the type of the error')

      var attributes = error[4]
      // top level attributes
      t.ok(util.isArray(attributes.stack_trace), 'should be an array')

      // custom attributes
      var ua = attributes.userAttributes
      t.equal(
        Object.keys(ua).length,
        5,
        'should have 5 custom attributes after merging'
      )
      // Overriden for error custom params
      Object.keys(expectedParams).forEach(function(paramKey) {
        t.equal(ua[paramKey], expectedParams[paramKey], 'has the passed in params')
      })

      // transaction custom params
      t.equal(ua.preErrorKeep, true, 'kept custom param from before error')
      t.equal(ua.postErrorKeep, 2, 'kept custom param from after error')

      t.equal(
        Object.keys(attributes.agentAttributes).length,
        7,
        'should have collected the query, request, and response params'
      )
    })
  })
})

test('errors in background transactions are collected with correct data', function(t) {
  const agent = helper.loadTestAgent(t)
  const api = new API(agent)

  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function() {
    var error = agent.errors.traceAggregator.errors[0]
    t.equal(error[1], 'OtherTransaction/TheGroup/SomeWork', 'should have set tx name')
    t.equal(error[2], 'errors in tx test', 'should have gathered the errors message')
    t.equal(error[3], 'Error', 'should have gathered the type of the error')

    var attributes = error[4]
    // top level attributes
    t.ok(util.isArray(attributes.stack_trace), 'should be an array')

    // custom attributes
    t.equal(
      Object.keys(attributes.userAttributes).length,
      0,
      'should have no custom params'
    )
    // agent/query parameters
    t.equal(
      Object.keys(attributes.agentAttributes).length,
      1,
      'should only have collected the "spanId" agent attribute'
    )
    t.equal(
      Object.keys(attributes.agentAttributes)[0],
      'spanId',
      'should only have collected the "spanId" agent attribute'
    )
    t.end()
  })

  // Create transaction generator
  api.startBackgroundTransaction('SomeWork', 'TheGroup', function() {
    api.noticeError(new Error('errors in tx test'))
    // Auto-end transaction in setImmediate.
  })
})
