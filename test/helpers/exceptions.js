/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('../../index')

const commands = {
  uncaughtException: function () {
    throw new Error('nothing can keep me down')
  },

  caughtUncaughtException: function (code) {
    // register a uncaughtException handler of our own
    process.once('uncaughtException', function (e) {
      process.send(e.message)
    })

    process.nextTick(function () {
      throw new Error(code)
    })
  },

  domainUncaughtException: function (message) {
    // eslint-disable-next-line node/no-deprecated-api
    const domain = require('domain')
    const d = domain.create()

    d.on('error', sendErrors)

    d.run(function () {
      setTimeout(function () {
        throw new Error(message)
      }, 10)
    })
  },

  runServerlessTransaction: function (err) {
    const stubEvent = {}
    const stubContext = {
      done: () => {},
      succeed: () => {},
      fail: () => {},
      functionName: 'testFunction',
      functionVersion: 'TestVersion',
      invokedFunctionArn: 'arn:test:function',
      memoryLimitInMB: '128',
      awsRequestId: 'testid'
    }
    const stubCallback = () => {}
    process.once('uncaughtException', function () {
      setTimeout(sendErrors, 15)
    })
    const handler = newrelic.setLambdaHandler(function handler() {
      throw new Error(err)
    })
    handler(stubEvent, stubContext, stubCallback)
  },

  checkAgent: function (err) {
    process.once('uncaughtException', function () {
      setTimeout(sendErrors, 15)
    })

    process.nextTick(function () {
      throw new Error(err)
    })
  },

  setUncaughtExceptionCallback: () => {
    process.setUncaughtExceptionCaptureCallback(() => {
      setTimeout(sendErrors, 15)
    })

    commands.uncaughtException()
  },

  unsetUncaughtExceptionCallback: () => {
    process.setUncaughtExceptionCaptureCallback(() => {
      setTimeout(sendErrors, 15)
    })
    process.once('uncaughtException', function () {
      setTimeout(sendErrors, 15)
    })
    process.setUncaughtExceptionCaptureCallback(null)

    commands.uncaughtException()
  }
}

function sendErrors() {
  const errData = {
    count: newrelic.agent.errors.traceAggregator.errors.length,
    messages: newrelic.agent.errors.traceAggregator.errors.map((e) => {
      return e[2]
    })
  }

  process.send(errData)
}

process.on('message', function (msg) {
  commands[msg.name](msg.args)
})
