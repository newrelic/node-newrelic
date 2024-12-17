/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent()
  const api = new API(agent)
  const http = require('http')
  ctx.nr = {
    agent,
    api,
    http
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('errors in web transactions should gather the query params', async function (t) {
  const { agent, api, http } = t.nr
  const plan = tspl(t, { plan: 9 })

  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  http
    .createServer(function (req, res) {
      req.resume()
      api.noticeError(new Error('errors in tx test'))
      res.end('success')
    })
    .listen(function () {
      const server = this
      const url = 'http://localhost:' + server.address().port + '/?some=param&data'
      http.get(url, function (res) {
        plan.equal(res.statusCode, 200, 'request should be successful')
        res.resume()
        server.close()
      })
    })

  agent.on('transactionFinished', function () {
    const error = agent.errors.traceAggregator.errors[0]
    plan.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')
    plan.equal(error[2], 'errors in tx test', 'should have gathered the errors message')
    plan.equal(error[3], 'Error', 'should have gathered the type of the error')

    const attributes = error[4]
    // top level attributes
    plan.ok(Array.isArray(attributes.stack_trace), 'should be an array')

    // custom attributes
    plan.equal(Object.keys(attributes.userAttributes).length, 0, 'should have no custom attributes')

    plan.equal(
      Object.keys(attributes.agentAttributes).length,
      9,
      'should have collected the query, request, and response params'
    )
    plan.equal(
      attributes.agentAttributes['request.parameters.some'],
      'param',
      'should have collected a query param with a value'
    )
    plan.equal(
      attributes.agentAttributes['request.parameters.data'],
      true,
      'should have collected a query param without a value'
    )
  })
  await plan.completed
})

test('multiple errors in web transactions should gather the query params', async function (t) {
  const { agent, api, http } = t.nr
  const plan = tspl(t, { plan: 17 })

  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  const names = ['first errors in tx test', 'second errors in tx test']

  http
    .createServer(function (req, res) {
      req.resume()
      api.noticeError(new Error(names[0]))
      api.noticeError(new Error(names[1]))
      res.end('success')
    })
    .listen(function () {
      const server = this
      let url = 'http://localhost:' + server.address().port + '/testing'
      url += '?some=param&data'
      http.get(url, function (res) {
        plan.equal(res.statusCode, 200, 'request should be successful')
        res.resume()
        server.close()
      })
    })

  agent.on('transactionFinished', function () {
    agent.errors.traceAggregator.errors.forEach(function (error) {
      plan.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')

      plan.notEqual(names.indexOf(error[2]), -1, 'should have gathered the errors message')
      // Remove the found name from the list of names. Since they are unique and
      // should only appear on one error.
      names.splice(names.indexOf(error[2]), 1)
      plan.equal(error[3], 'Error', 'should have gathered the type of the error')

      const attributes = error[4]
      // top level attributes
      plan.ok(Array.isArray(attributes.stack_trace), 'should be an array')

      // custom attributes
      plan.equal(
        Object.keys(attributes.userAttributes).length,
        0,
        'should have no custom attributes'
      )

      plan.equal(
        Object.keys(attributes.agentAttributes).length,
        9,
        'should have collected the query, request, and response params'
      )
      plan.equal(
        attributes.agentAttributes['request.parameters.some'],
        'param',
        'should have collected a query param with a value'
      )
      plan.equal(
        attributes.agentAttributes['request.parameters.data'],
        true,
        'should have collected a query param without a value'
      )
    })
  })

  await plan.completed
})

test('errors in web transactions should gather and merge custom params', async function (t) {
  const { agent, api, http } = t.nr
  const plan = tspl(t, { plan: 12 })

  agent.config.attributes.enabled = true

  http
    .createServer(function (req, res) {
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
    })
    .listen(function () {
      const server = this
      const url = 'http://localhost:' + server.address().port + '/'
      http.get(url, function (res) {
        plan.equal(res.statusCode, 200, 'request should be successful')
        res.resume()
        server.close()
      })
    })

  agent.on('transactionFinished', function () {
    const error = agent.errors.traceAggregator.errors[0]
    plan.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')
    plan.equal(error[2], 'errors in tx test', 'should have gathered the errors message')
    plan.equal(error[3], 'Error', 'should have gathered the type of the error')

    const attributes = error[4]
    // top level attributes
    plan.ok(Array.isArray(attributes.stack_trace), 'should be an array')

    // custom attributes
    const ua = attributes.userAttributes
    plan.equal(Object.keys(ua).length, 5, 'should have 5 custom attributes after merging')
    plan.equal(ua.preErrorKeep, true, 'kept custom param from before error')
    plan.equal(ua.preErrorReplace, 'yesssssssss', 'replace custom param from before error')
    plan.equal(ua.thisOneIsUnique, 1987, 'custom param that is not overriding also was kept')
    plan.equal(ua.postErrorKeep, 2, 'kept custom param from after error')
    plan.equal(ua.postErrorReplace, 'this one is better', 'replace custom param from after error')

    plan.equal(
      Object.keys(attributes.agentAttributes).length,
      7,
      'should have collected the query, request, and response params'
    )
  })

  await plan.completed
})

test('multiple errors in web tx should gather and merge custom params', async function (t) {
  const { agent, api, http } = t.nr
  const plan = tspl(t, { plan: 21 })

  agent.config.attributes.enabled = true

  const errorData = [
    {
      name: 'first error indexOf tx test',
      customParams: {
        preErrorReplace: 'yesssss',
        thisOneIsUnique: 1987,
        postErrorReplace: 'this one is better'
      }
    },
    {
      name: 'second error in tx test',
      customParams: {
        preErrorReplace: 'affirmative',
        thisOneIsUniqueToo: 1776,
        postErrorReplace: 'no, this one is better'
      }
    }
  ]

  http
    .createServer(function (req, res) {
      req.resume()

      api.addCustomAttribute('preErrorKeep', true)
      api.addCustomAttribute('preErrorReplace', 'nooooooooo')

      api.noticeError(new Error(errorData[0].name), errorData[0].customParams)

      api.addCustomAttribute('postErrorKeep', 2)
      api.addCustomAttribute('postErrorReplace', 'omg why')

      api.noticeError(new Error(errorData[1].name), errorData[1].customParams)

      res.end('success')
    })
    .listen(function () {
      const server = this
      const url = 'http://localhost:' + server.address().port + '/'
      http.get(url, function (res) {
        plan.equal(res.statusCode, 200, 'request should be successful')
        res.resume()
        server.close()
      })
    })

  agent.on('transactionFinished', function () {
    agent.errors.traceAggregator.errors.forEach(function (error) {
      let expectedParams
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

      plan.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have default tx name')
      plan.equal(error[3], 'Error', 'should have gathered the type of the error')

      const attributes = error[4]
      // top level attributes
      plan.ok(Array.isArray(attributes.stack_trace), 'should be an array')

      // custom attributes
      const ua = attributes.userAttributes
      plan.equal(Object.keys(ua).length, 5, 'should have 5 custom attributes after merging')
      // Overriden for error custom params
      Object.keys(expectedParams).forEach(function (paramKey) {
        plan.equal(ua[paramKey], expectedParams[paramKey], 'has the passed in params')
      })

      // transaction custom params
      plan.equal(ua.preErrorKeep, true, 'kept custom param from before error')
      plan.equal(ua.postErrorKeep, 2, 'kept custom param from after error')

      plan.equal(
        Object.keys(attributes.agentAttributes).length,
        7,
        'should have collected the query, request, and response params'
      )
    })
  })

  await plan.completed
})

test('errors in background transactions are collected with correct data', async function (t) {
  const { agent, api } = t.nr
  const plan = tspl(t, { plan: 7 })

  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function () {
    const error = agent.errors.traceAggregator.errors[0]
    plan.equal(error[1], 'OtherTransaction/TheGroup/SomeWork', 'should have set tx name')
    plan.equal(error[2], 'errors in tx test', 'should have gathered the errors message')
    plan.equal(error[3], 'Error', 'should have gathered the type of the error')

    const attributes = error[4]
    // top level attributes
    plan.ok(Array.isArray(attributes.stack_trace), 'should be an array')

    // custom attributes
    plan.equal(Object.keys(attributes.userAttributes).length, 0, 'should have no custom params')
    // agent/query parameters
    plan.equal(
      Object.keys(attributes.agentAttributes).length,
      1,
      'should only have collected the "spanId" agent attribute'
    )
    plan.equal(
      Object.keys(attributes.agentAttributes)[0],
      'spanId',
      'should only have collected the "spanId" agent attribute'
    )
  })

  // Create transaction generator
  api.startBackgroundTransaction('SomeWork', 'TheGroup', function () {
    api.noticeError(new Error('errors in tx test'))
    // Auto-end transaction in setImmediate.
  })

  await plan.completed
})
