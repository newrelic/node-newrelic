/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

tap.test('api.setErrorGroupCallback()', (t) => {
  t.autoend()

  let agent
  let api
  let http
  let express
  let app
  let server

  t.beforeEach(() => {
    agent = helper.loadTestAgent(t)
    api = new API(agent)
    http = require('http')
    express = require('express')
    app = express()
  })

  t.afterEach(() => {
    server.close()
    helper.unloadAgent(agent)
  })

  t.test('should not add the Error Group when callback is not a function', (t) => {
    api.setErrorGroupCallback('this-is-a-string')

    app.get('/test', (req, res) => {
      return res.status(500).json({ message: 'Boom' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 500, 'request should return a 500')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.notOk(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      t.notOk(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should not add the Error Group when callback throws', (t) => {
    api.setErrorGroupCallback(function callback() {
      throw new Error('whoops')
    })

    app.get('/test', (req, res) => {
      return res.status(500).json({ message: 'Boom' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 500, 'request should return a 500')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.notOk(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      t.notOk(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should not add the Error Group when callback returns empty string', (t) => {
    api.setErrorGroupCallback(function callback() {
      return ''
    })

    app.get('/test', (req, res) => {
      return res.status(500).json({ message: 'Boom' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 500, 'request should return a 500')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.notOk(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      t.notOk(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should not add the Error Group when callback returns not string', (t) => {
    api.setErrorGroupCallback(function callback() {
      return { 'error.group.name': 'test-group' }
    })

    app.get('/test', (req, res) => {
      return res.status(500).json({ message: 'Boom' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 500, 'request should return a 500')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.notOk(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'should not add `error.group.name` attribute to trace'
      )
      t.notOk(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'should not add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should pass the correct arguments to the callback (transaction)', (t) => {
    api.setErrorGroupCallback(function callback(metadata) {
      t.equal(metadata['request.uri'], '/test', 'should give the request.uri attribute')
      t.equal(metadata['http.statusCode'], '500', 'should give the http.statusCode attribute')
      t.equal(metadata['http.method'], 'GET', 'should give the http.method attribute')

      return 'test-group'
    })

    app.get('/test', (req, res) => {
      return res.status(500).json({ message: 'Boom' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 500, 'request should return a 500')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to trace'
      )
      t.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should pass the correct arguments to the callback (error)', (t) => {
    const expectedError = new Error('boom')
    api.setErrorGroupCallback(function callback(metadata) {
      t.equal(metadata.error, expectedError, 'should give the error attribute')

      return 'test-group'
    })

    app.get('/test', () => {
      throw expectedError
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 500, 'request should return a 500')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to trace'
      )
      t.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should pass the correct arguments to the callback (custom attributes)', (t) => {
    api.setErrorGroupCallback(function callback(metadata) {
      t.same(metadata.customAttributes, { foo: 'bar' })

      return 'test-group'
    })

    app.get('/test', (req, res) => {
      api.addCustomAttribute('foo', 'bar')
      api.noticeError(new Error('boom'))
      return res.status(200).json({ message: 'OK' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 200, 'request should return a 500')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to trace'
      )
      t.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should pass the correct arguments to the callback (noticeError + is expected)', (t) => {
    const expectedError = new Error('boom')
    api.setErrorGroupCallback(function callback(metadata) {
      t.equal(metadata.error, expectedError, 'should give the error')
      t.equal(metadata['error.expected'], true, 'should give the error.expected')
      t.equal(metadata['request.uri'], '/test', 'should give the request.uri')
      t.equal(metadata['http.statusCode'], '200', 'should give the http.statusCode')
      t.equal(metadata['http.method'], 'GET', 'should give the http.method')

      return 'test-group'
    })

    app.get('/test', (req, res) => {
      api.noticeError(expectedError, true)
      return res.status(200).json({ message: 'OK' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 200, 'request should return a 200')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to trace'
      )
      t.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'test-group',
        'should add `error.group.name` attribute to event'
      )
    })
  })

  t.test('should overwrite previous callbacks if called more than once', (t) => {
    const expectedError = new Error('boom')
    api.setErrorGroupCallback(function callback() {
      return 'group #1'
    })

    app.get('/test', (req, res) => {
      api.setErrorGroupCallback(function secondCallback() {
        return 'group #2'
      })
      api.noticeError(expectedError, true)
      return res.status(200).json({ message: 'OK' })
    })

    server = app.listen(0)
    const url = `http://localhost:${server.address().port}/test`

    http.get(url, function (res) {
      t.equal(res.statusCode, 200, 'request should return a 200')
      t.end()
    })

    agent.on('transactionFinished', function () {
      t.equal(
        agent.errors.traceAggregator.errors[0][4].agentAttributes['error.group.name'],
        'group #2',
        'should add `error.group.name` attribute to trace'
      )
      t.equal(
        agent.errors.eventAggregator.getEvents()[0][2]['error.group.name'],
        'group #2',
        'should add `error.group.name` attribute to event'
      )
    })
  })
})
