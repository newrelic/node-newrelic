/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const cp = require('child_process')
const path = require('path')
const helper = require('../../lib/agent_helper')
const helpersDir = path.join(path.resolve(__dirname, '../../'), 'helpers')

test('Uncaught exceptions', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const proc = startProc()

  const timer = setTimeout(function () {
    proc.kill()
  }, 10000)

  proc.on('exit', function () {
    plan.ok(1, 'Did not timeout')
    clearTimeout(timer)
  })

  proc.send({ name: 'uncaughtException' })
  await plan.completed
})

test('Caught uncaught exceptions', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const proc = startProc()

  const theRightStuff = 31415927
  const timer = setTimeout(function () {
    proc.kill()
  }, 10000)

  proc.on('message', function (code) {
    plan.equal(parseInt(code, 10), theRightStuff, 'should have the correct code')
    clearTimeout(timer)
    proc.kill()
  })

  proc.send({ name: 'caughtUncaughtException', args: theRightStuff })
  await plan.completed
})

test('Report uncaught exceptions', async (t) => {
  const plan = tspl(t, { plan: 3 })

  const proc = startProc()
  const message = 'I am a test error'
  let messageReceived = false

  proc.on('message', function (errors) {
    messageReceived = true
    plan.equal(errors.count, 1, 'should have collected an error')
    plan.equal(errors.messages[0], message, 'should have the correct message')
    proc.kill()
  })

  proc.on('exit', function () {
    plan.ok(messageReceived, 'should receive message')
  })

  proc.send({ name: 'checkAgent', args: message })
  await plan.completed
})

test('Triggers harvest while in serverless mode', async (t) => {
  const plan = tspl(t, { plan: 9 })

  const proc = startProc({
    NEW_RELIC_SERVERLESS_MODE_ENABLED: 'y',
    NEW_RELIC_LOG_ENABLED: 'false',
    NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: 'false',
    NEW_RELIC_HOME: helpersDir
  })
  const message = 'I am a test error'
  let messageReceived = false
  let payload = ''
  proc.stdout.on('data', function bufferData(data) {
    payload += data.toString('utf8')
  })

  proc.on('message', function (errors) {
    messageReceived = true
    plan.equal(errors.count, 0, 'should have harvested the error')

    const lambdaPayload = findLambdaPayload(payload)
    plan.ok(lambdaPayload, 'should find lambda payload log line')

    const parsed = JSON.parse(lambdaPayload)

    helper.decodeServerlessPayload(parsed[2], function testDecoded(err, decoded) {
      plan.ok(!err, 'should not run into errors decoding serverless payload')
      plan.ok(decoded.metadata, 'metadata should be present')
      plan.ok(decoded.data, 'data should be present')
      const error = decoded.data.error_data[1][0]
      plan.equal(error[2], message)
      const transactionEvents = decoded.data.analytic_event_data
      plan.ok(transactionEvents, 'should have a transaction event')
      const transactionEvent = transactionEvents[2][0]
      plan.ok(transactionEvent[0].error, 'should be errored')
      proc.kill()
    })
  })

  proc.on('exit', function () {
    plan.ok(messageReceived, 'should receive message')
  })

  proc.send({ name: 'runServerlessTransaction', args: message })
  await plan.completed
})

test('Do not report domained exceptions', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const proc = startProc()
  const message = 'I am a test error'
  let messageReceived = false

  proc.on('message', function (errors) {
    messageReceived = true
    plan.equal(errors.count, 0, 'should not have collected an error')
    plan.deepEqual(errors.messages, [], 'should have no error messages')
    proc.kill()
  })

  proc.on('exit', function () {
    plan.ok(messageReceived, 'should receive message')
  })

  proc.send({ name: 'domainUncaughtException', args: message })
  await plan.completed
})

test('Report exceptions handled in setUncaughtExceptionCaptureCallback', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const proc = startProc()
  let messageReceived = false

  proc.on('message', (errors) => {
    messageReceived = true
    plan.equal(errors.count, 0, 'should not have collected an error')
    plan.deepEqual(errors.messages, [], 'should have no error messages')
    proc.kill()
  })

  proc.on('exit', () => {
    plan.ok(messageReceived, 'should receive message')
  })

  proc.send({ name: 'setUncaughtExceptionCallback' })
  await plan.completed
})

test('Report exceptions handled in setUncaughtExceptionCaptureCallback', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const proc = startProc()
  let messageReceived = false

  proc.on('message', (errors) => {
    messageReceived = true
    plan.equal(errors.count, 1, 'should have collected an error')
    plan.deepEqual(errors.messages, ['nothing can keep me down'], 'should have error messages')
    proc.kill()
  })

  proc.on('exit', () => {
    plan.ok(messageReceived, 'should receive message')
  })

  proc.send({ name: 'unsetUncaughtExceptionCallback' })
  await plan.completed
})

function startProc(env) {
  return cp.fork(path.join(helpersDir, 'exceptions.js'), {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: env
  })
}

function findLambdaPayload(rawLogData) {
  const logLines = rawLogData.split('\n')
  for (let i = 0; i < logLines.length; i++) {
    const logLine = logLines[i]
    if (logLine.includes('NR_LAMBDA_MONITORING')) {
      return logLine
    }
  }
}
