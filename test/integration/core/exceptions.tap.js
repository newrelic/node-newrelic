'use strict'

const tap = require('tap')
const cp = require('child_process')
const path = require('path')
const helper = require('../../lib/agent_helper')
const helpersDir = path.join(path.resolve(__dirname, '../../'), 'helpers')

tap.test('Uncaught exceptions', (t) => {
  var proc = startProc()

  var timer = setTimeout(function() {
    t.fail('child did not exit')
    proc.kill()
    t.end()
  }, 10000)

  proc.on('exit', function() {
    t.ok(true, 'Did not timeout')
    clearTimeout(timer)
    t.end()
  })

  proc.send({name: 'uncaughtException'})
})

tap.test('Caught uncaught exceptions', (t) => {
  var proc = startProc()

  var theRightStuff = 31415927
  var timer = setTimeout(function() {
    t.fail('child hung')
    proc.kill()
    t.end()
  }, 10000)

  proc.on('message', function(code) {
    t.equal(parseInt(code, 10), theRightStuff, 'should have the correct code')
    clearTimeout(timer)
    proc.kill()
    t.end()
  })

  proc.send({name: 'caughtUncaughtException', args: theRightStuff})
})

tap.test('Report uncaught exceptions', (t) => {
  t.plan(3)

  var proc = startProc()
  var message = 'I am a test error'
  var messageReceived = false

  proc.on('message', function(errors) {
    messageReceived = true
    t.equal(errors.count, 1, 'should have collected an error')
    t.equal(errors.messages[0], message, 'should have the correct message')
    proc.kill()
  })

  proc.on('exit', function() {
    t.ok(messageReceived, 'should receive message')
    t.end()
  })

  proc.send({name: 'checkAgent', args: message})
})

tap.test('Triggers harvest while in serverless mode', (t) => {
  t.plan(9)

  var proc = startProc({
    'NEW_RELIC_SERVERLESS_MODE_ENABLED': 'y',
    'NEW_RELIC_LOG_ENABLED': 'false',
    'NEW_RELIC_DISTRIBUTED_TRACING_ENABLED': 'false',
    'NEW_RELIC_HOME': helpersDir
  })
  var message = 'I am a test error'
  var messageReceived = false
  var payload = ''
  proc.stdout.on('data', function bufferData(data) {
    payload += data.toString('utf8')
  })

  proc.on('message', function(errors) {
    messageReceived = true
    t.equal(errors.count, 0, 'should have harvested the error')

    const lambdaPayload = findLambdaPayload(payload)
    t.ok(lambdaPayload, 'should find lambda payload log line')

    const parsed = JSON.parse(lambdaPayload)

    helper.decodeServerlessPayload(t, parsed[2], function testDecoded(err, decoded) {
      t.error(err, 'should not run into errors decoding serverless payload')
      t.ok(decoded.metadata, 'metadata should be present')
      t.ok(decoded.data, 'data should be present')
      const error = decoded.data.error_data[1][0]
      t.equal(error[2], message)
      const transactionEvents = decoded.data.analytic_event_data
      t.ok(transactionEvents, 'should have a transaction event')
      const transactionEvent = transactionEvents[2][0]
      t.ok(transactionEvent[0].error, 'should be errored')
      proc.kill()
    })
  })

  proc.on('exit', function() {
    t.ok(messageReceived, 'should receive message')
    t.end()
  })

  proc.send({name: 'runServerlessTransaction', args: message})
})

tap.test('Do not report domained exceptions', (t) => {
  t.plan(3)
  var proc = startProc()
  var message = 'I am a test error'
  var messageReceived = false

  proc.on('message', function(errors) {
    messageReceived = true
    t.equal(errors.count, 0, 'should not have collected an error')
    t.same(errors.messages, [], 'should have no error messages')
    proc.kill()
  })

  proc.on('exit', function() {
    t.ok(messageReceived, 'should receive message')
    t.end()
  })

  proc.send({name: 'domainUncaughtException', args: message})
})

// only available on Node >=9.3
if (process.setUncaughtExceptionCaptureCallback) {
  tap.test('Report exceptions handled in setUncaughtExceptionCaptureCallback', (t) => {
    t.plan(3)
    const proc = startProc()
    let messageReceived = false

    proc.on('message', (errors) => {
      messageReceived = true
      t.equal(errors.count, 0, 'should not have collected an error')
      t.same(errors.messages, [], 'should have no error messages')
      proc.kill()
    })

    proc.on('exit', () => {
      t.ok(messageReceived, 'should receive message')
      t.end()
    })

    proc.send({ name: 'setUncaughtExceptionCallback' })
  })

  tap.test('Report exceptions handled in setUncaughtExceptionCaptureCallback', (t) => {
    t.plan(3)
    const proc = startProc()
    let messageReceived = false

    proc.on('message', (errors) => {
      messageReceived = true
      t.equal(errors.count, 1, 'should have collected an error')
      t.same(errors.messages, ['nothing can keep me down'], 'should have error messages')
      proc.kill()
    })

    proc.on('exit', () => {
      t.ok(messageReceived, 'should receive message')
      t.end()
    })

    proc.send({ name: 'unsetUncaughtExceptionCallback' })
  })
}

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
    if (logLine.includes("NR_LAMBDA_MONITORING")) {
      return logLine
    }
  }
}
