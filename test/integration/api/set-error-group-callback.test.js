/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

test('api.setErrorGroupCallback()', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    const api = new API(agent)
    const http = require('http')
    const express = require('express')
    const app = express()
    app.get('/test', (req, res) => {
      res.status(500).json({ message: 'Boom' })
    })

    const expectedError = new Error('Boom')
    app.get('/test-throw', () => {
      throw expectedError
    })

    app.get('/test-attrs', (req, res) => {
      api.addCustomAttribute('foo', 'bar')
      api.noticeError(expectedError)
      res.status(200).json({ message: 'OK' })
    })

    app.get('/test-notice-error', (req, res) => {
      api.noticeError(expectedError, true)
      return res.status(200).json({ message: 'OK' })
    })

    const server = app.listen(0)
    const baseUrl = `http://localhost:${server.address().port}`
    ctx.nr = {
      agent,
      api,
      baseUrl,
      expectedError,
      http,
      server
    }
  })

  t.afterEach((ctx) => {
    const { agent, server } = ctx.nr
    server.close()
    helper.unloadAgent(agent)
  })

  await t.test('should not add the Error Group when callback is not a function', (t, end) => {
    const { agent, api, http, baseUrl } = t.nr
    api.setErrorGroupCallback('this-is-a-string')

    const url = `${baseUrl}/test`
    http.get(url, function (res) {
      assert.equal(res.statusCode, 500, 'request should return a 500')
      end()
    })

    agent.on('transactionFinished', function () {
      assert.ok(
        !agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      assert.ok(
        !agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  await t.test('should not add the Error Group when callback throws', (t, end) => {
    const { agent, api, http, baseUrl } = t.nr
    const url = `${baseUrl}/test`
    api.setErrorGroupCallback(function callback() {
      throw new Error('whoops')
    })

    http.get(url, function (res) {
      assert.equal(res.statusCode, 500, 'request should return a 500')
      end()
    })

    agent.on('transactionFinished', function () {
      assert.ok(
        !agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      assert.ok(
        !agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  await t.test('should not add the Error Group when callback returns empty string', (t, end) => {
    const { agent, api, http, baseUrl } = t.nr
    const url = `${baseUrl}/test`
    api.setErrorGroupCallback(function callback() {
      return ''
    })

    http.get(url, function (res) {
      assert.equal(res.statusCode, 500, 'request should return a 500')
      end()
    })

    agent.on('transactionFinished', function () {
      assert.ok(
        !agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      assert.ok(
        !agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  await t.test('should not add the Error Group when callback returns not string', (t, end) => {
    const { agent, api, http, baseUrl } = t.nr
    const url = `${baseUrl}/test`
    api.setErrorGroupCallback(function callback() {
      return { 'error.group.name': 'test-group' }
    })

    http.get(url, function (res) {
      assert.equal(res.statusCode, 500, 'request should return a 500')
      end()
    })

    agent.on('transactionFinished', function () {
      assert.ok(
        !agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      assert.ok(
        !agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  await t.test('should pass the correct arguments to the callback (transaction)', (t, end) => {
    const { agent, api, http, baseUrl } = t.nr
    const url = `${baseUrl}/test`
    api.setErrorGroupCallback(function callback(metadata) {
      assert.equal(metadata['request.uri'], '/test', 'should give the request.uri attribute')
      assert.equal(metadata['http.statusCode'], '500', 'should give the http.statusCode attribute')
      assert.equal(metadata['http.method'], 'GET', 'should give the http.method attribute')

      return 'test-group'
    })

    http.get(url, function (res) {
      assert.equal(res.statusCode, 500, 'request should return a 500')
      end()
    })

    agent.on('transactionFinished', function () {
      assert.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to trace'
      )
      assert.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to event'
      )
    })
  })

  await t.test('should pass the correct arguments to the callback (error)', (t, end) => {
    const { agent, api, http, baseUrl, expectedError } = t.nr
    const url = `${baseUrl}/test-throw`
    api.setErrorGroupCallback(function callback(metadata) {
      assert.equal(metadata.error, expectedError, 'should give the error attribute')

      return 'test-group'
    })

    http.get(url, function (res) {
      assert.equal(res.statusCode, 500, 'request should return a 500')
      end()
    })

    agent.on('transactionFinished', function () {
      assert.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to trace'
      )
      assert.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to event'
      )
    })
  })

  await t.test(
    'should pass the correct arguments to the callback (custom attributes)',
    (t, end) => {
      const { agent, api, http, baseUrl } = t.nr
      const url = `${baseUrl}/test-attrs`
      api.setErrorGroupCallback(function callback(metadata) {
        assert.deepEqual(metadata.customAttributes, { foo: 'bar' })

        return 'test-group'
      })

      http.get(url, function (res) {
        assert.equal(res.statusCode, 200, 'request should return a 500')
        end()
      })

      agent.on('transactionFinished', function () {
        assert.equal(
          agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
          'test-group',
          'should add `error.group.name` attribute to trace'
        )
        assert.equal(
          agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
          'test-group',
          'should add `error.group.name` attribute to event'
        )
      })
    }
  )

  await t.test(
    'should pass the correct arguments to the callback (noticeError + is expected)',
    (t, end) => {
      const { agent, api, http, baseUrl, expectedError } = t.nr
      const url = `${baseUrl}/test-notice-error`
      api.setErrorGroupCallback(function callback(metadata) {
        assert.equal(metadata.error, expectedError, 'should give the error')
        assert.equal(metadata['error.expected'], true, 'should give the error.expected')
        assert.equal(metadata['request.uri'], '/test', 'should give the request.uri')
        assert.equal(metadata['http.statusCode'], '200', 'should give the http.statusCode')
        assert.equal(metadata['http.method'], 'GET', 'should give the http.method')

        return 'test-group'
      })

      http.get(url, function (res) {
        assert.equal(res.statusCode, 200, 'request should return a 200')
        end()
      })

      agent.on('transactionFinished', function () {
        assert.equal(
          agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
          'test-group',
          'should add `error.group.name` attribute to trace'
        )
        assert.equal(
          agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
          'test-group',
          'should add `error.group.name` attribute to event'
        )
      })
    }
  )

  await t.test('should overwrite previous callbacks if called more than once', (t, end) => {
    const { agent, api, http, baseUrl } = t.nr
    const url = `${baseUrl}/test-notice-error`
    api.setErrorGroupCallback(function callback() {
      return 'group #1'
    })
    api.setErrorGroupCallback(function secondCallback() {
      return 'group #2'
    })

    http.get(url, function (res) {
      assert.equal(res.statusCode, 200, 'request should return a 200')
      end()
    })

    agent.on('transactionFinished', function () {
      assert.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'group #2',
        'should add `error.group.name` attribute to trace'
      )
      assert.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'group #2',
        'should add `error.group.name` attribute to event'
      )
    })
  })
})
