/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const { Writable } = require('node:stream')
const tspl = require('@matteo.collina/tspl')
const sinon = require('sinon')

const helper = require('#testlib/agent_helper.js')
const tempRemoveListeners = require('../../lib/temp-remove-listeners')
const AwsLambda = require('#agentlib/serverless/aws-lambda.js')

const groupName = 'Function'
const functionName = 'testNameStreaming'
const expectedTransactionName = groupName + '/' + functionName
const expectedBgTransactionName = 'OtherTransaction/' + expectedTransactionName
const errorMessage = 'sad day'
const { DESTINATIONS: ATTR_DEST } = require('../../../lib/config/attribute-filter')

// Attribute key names:
const REQ_ID = 'aws.requestId'
const LAMBDA_ARN = 'aws.lambda.arn'
const COLDSTART = 'aws.lambda.coldStart'

function getMetrics(agent) {
  return agent.metrics._metrics
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent({
    allow_all_headers: true,
    attributes: {
      exclude: ['request.headers.x*', 'response.headers.x*']
    },
    serverless_mode: { enabled: true }
  })

  const { request: responseStream, responseDone } = createAwsResponseStream()
  ctx.nr.responseStream = responseStream
  ctx.nr.responseDone = responseDone

  process.env.NEWRELIC_PIPE_PATH = os.devNull
  const awsLambda = new AwsLambda(ctx.nr.agent)
  ctx.nr.awsLambda = awsLambda
  awsLambda._resetModuleState()

  ctx.nr.event = {}
  ctx.nr.context = {
    done() {},
    success() {},
    fail() {},
    functionName,
    functionVersion: 'test_version',
    invokedFunctionArn: 'arn:test:function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-id'
  }

  ctx.nr.error = new SyntaxError(errorMessage)
})

test.afterEach(async (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  if (ctx.nr.responseStream.writableFinished !== true) {
    await ctx.nr.responseStream.end()
    await ctx.nr.responseStream.destroy()
  }
})

/**
 * Creates a writable stream that simulates the stream actions AWS's Lambda
 * runtime expects when working with streamable handlers.
 *
 * @returns {Writable} Stream
 */
function createAwsResponseStream() {
  let responseDoneResolve
  let responseDoneReject
  const responseDonePromise = new Promise((resolve, reject) => {
    responseDoneResolve = resolve
    responseDoneReject = reject
  })

  let result = ''
  const stream = new Writable({
    write(chunk, encoding, callback) {
      result += chunk
      callback()
    }
  })

  stream.setContentType = function () {}

  stream.on('error', (error) => {
    if (responseDoneReject) responseDoneReject(error)
  })

  stream.on('close', () => {
    responseDoneResolve(result)
  })

  return {
    request: stream,
    headersDone: Promise.resolve(),
    responseDone: responseDonePromise
  }
}

/**
 * Decorate the provided AWS Lambda handler in the manner AWS Lambda expects
 * streaming capable handlers to be decorated.
 *
 * @param {function} handler The user's Lambda application entry point
 * @param {object} options An object which optionally may contain a highWaterMark key
 * @returns {function} The same function, decorated with a symbol to indicate response streaming
 */
function decorateHandler(handler, options) {
  handler[Symbol.for('aws.lambda.runtime.handler.streaming')] = 'response'
  if (typeof options?.highWaterMark === 'number') {
    handler[Symbol.for('aws.lambda.runtime.handler.highWaterMark')] = options.highWaterMark
  }
  return handler
}

/**
 * Writes a set of messages to the provided response stream in a delayed
 * manner in order to simulate a long-running response stream.
 *
 * @param {*[]} chunks Elements of a message to stream
 * @param {object} stream A Node writable stream, to simulate AWS's responseStream object
 * @param {number} delay A number of milliseconds to wait before writing each chunk to the stream
 *
 * @returns {Promise} Promise to ensure completion of writes to a test response stream
 */
function writeToResponseStream(chunks, stream, delay) {
  const writes = []
  for (const chunk of chunks) {
    const promise = new Promise(resolve => {
      setTimeout(() => {
        stream.write(chunk)
        resolve()
      }, delay)
    })
    writes.push(promise)
  }
  return Promise.all(writes)
}

test('should return original handler if not a function', (t) => {
  const handler = {}
  const newHandler = t.nr.awsLambda.patchLambdaHandler(handler)

  assert.equal(newHandler, handler)
})

test('should preserve streaming symbols after wrapping', async (t) => {
  const { agent, awsLambda } = t.nr
  const spy = sinon.spy(agent, 'recordSupportability')
  t.after(() => {
    spy.restore()
  })
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(async () => {})
  const patched = awsLambda.patchLambdaHandler(handler)
  assert.ok(patched[Symbol.for('aws.lambda.runtime.handler.streaming')])
  assert.equal(agent.recordSupportability.callCount, 1)
  assert.equal(agent.recordSupportability.args[0][0], 'Nodejs/Serverless/Lambda/ResponseStreaming')
})

test('should preserve streaming highWaterMark symbol after wrapping, if defined', async (t) => {
  const { agent, awsLambda } = t.nr
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(async () => {}, { highWaterMark: 8000 })
  const patched = awsLambda.patchLambdaHandler(handler)
  assert.ok(patched[Symbol.for('aws.lambda.runtime.handler.highWaterMark')])
})

test('should preserve any symbol set on the handler function', async (t) => {
  const { agent, awsLambda } = t.nr
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(async () => {})
  handler[Symbol.for('aws.lambda.runtime.handler.newSymbol')] = 'mySymbolValue'
  const patched = awsLambda.patchLambdaHandler(handler)
  assert.ok(patched[Symbol.for('aws.lambda.runtime.handler.newSymbol')])
})

test('should pick up on the arn', async (t) => {
  const { agent, awsLambda, event, responseStream, context } = t.nr
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(async () => {})
  const patched = awsLambda.patchLambdaHandler(handler)
  await patched(event, responseStream, context)
  assert.equal(agent.collector.metadata.arn, context.invokedFunctionArn)
})

test('should set close/error listeners on the stream', async (t) => {
  const { agent, awsLambda, event, responseStream, context } = t.nr
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(async (event, responseStream) => {
    const closeListeners = responseStream.listeners('close')
    const errorListeners = responseStream.listeners('error')
    assert.equal(closeListeners.length, 2)
    assert.equal(errorListeners.length, 2)
    assert.ok(closeListeners[1].toString().indexOf('txnEnder') > -1, 'the agent should set a transaction ender on stream end')
    assert.ok(errorListeners[1].toString().indexOf('shim') > -1, 'the agent should listen for stream errors')
  })
  const patched = awsLambda.patchLambdaHandler(handler)
  await patched(event, responseStream, context)
})

test('should create a segment for handler', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { awsLambda, event, responseStream, context, responseDone } = t.nr
  const handler = decorateHandler(async (event, responseStream) => {
    const segment = awsLambda.shim.getSegment()
    plan.equal(segment.name, functionName)
    const chunks = ['step 1', ' step 2', ' step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  const streamData = await responseDone
  plan.equal(streamData, 'step 1 step 2 step 3')
  await plan.completed
})

test('should create a transaction for handler', async (t) => {
  const plan = tspl(t, { plan: 7 })
  const { agent, awsLambda, event, responseStream, context, responseDone } = t.nr
  agent.on('transactionFinished', (tx) => {
    const txTrace = tx.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    plan.equal(txTrace[REQ_ID], context.awsRequestId)
    plan.equal(txTrace[LAMBDA_ARN], context.invokedFunctionArn)
    plan.equal(txTrace[COLDSTART], true)
  })

  const handler = decorateHandler(async (event, responseStream) => {
    const transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    plan.ok(transaction)
    plan.equal(transaction.type, 'bg')
    plan.equal(transaction.getFullName(), expectedBgTransactionName)
    plan.ok(transaction.isActive())
    responseStream.end()
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await responseDone
  await plan.completed
})

test('should end transactions on a beforeExit event on process', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const { agent, awsLambda, event, responseStream, context, responseDone } = t.nr
  tempRemoveListeners({ t, emitter: process, event: 'beforeExit' })

  agent.on('harvestStarted', () => {
    plan.ok(1)
  })

  const handler = decorateHandler(async (event, responseStream) => {
    const transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    plan.ok(transaction)
    plan.equal(transaction.type, 'bg')
    plan.equal(transaction.getFullName(), expectedBgTransactionName)
    plan.ok(transaction.isActive())
    responseStream.end()

    process.emit('beforeExit')

    plan.equal(transaction.isActive(), false)
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await responseDone
  await plan.completed
})

test('should end transactions after response stream finishes', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { agent, awsLambda, event, responseStream, context, responseDone } = t.nr
  let transaction

  const handler = decorateHandler(async (event, responseStream) => {
    transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await responseDone
  plan.equal(transaction.isActive(), false)
  await plan.completed
})

test('should handle error when stream emits error', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent, awsLambda, event, responseStream, context, responseDone } = t.nr
  let transaction

  agent.on('harvestStarted', () => {
    const { errors } = agent.errors.traceAggregator
    plan.equal(errors.length, 1)
    const [, tx, err] = errors[0]
    plan.equal(tx, 'OtherTransaction/Function/testNameStreaming')
    plan.equal(err, 'stream failed')
  })

  const handler = decorateHandler(async (event, responseStream) => {
    transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    const err = new Error('stream failed')
    responseStream.destroy(err)
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  try {
    await responseDone
  } catch (err) {
    plan.equal(err.message, 'stream failed')
  }
  plan.equal(transaction.isActive(), false)
  await plan.completed
})

test('should record standard background metrics', async (t) => {
  const plan = tspl(t, { plan: 9 })
  const { agent, awsLambda, event, responseStream, context, responseDone } = t.nr
  agent.on('harvestStarted', confirmMetrics)

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await responseDone
  await plan.completed

  function confirmMetrics() {
    const unscopedMetrics = getMetrics(agent).unscoped
    plan.ok(unscopedMetrics)

    const otherTransactionAllName = 'OtherTransaction/all'
    const otherTransactionAllMetric = unscopedMetrics[otherTransactionAllName]
    plan.ok(otherTransactionAllMetric)
    plan.equal(otherTransactionAllMetric.callCount, 1)

    const bgTransactionNameMetric = unscopedMetrics[expectedBgTransactionName]
    plan.ok(bgTransactionNameMetric)
    plan.equal(bgTransactionNameMetric.callCount, 1)

    const otherTransactionTotalTimeMetric = unscopedMetrics.OtherTransactionTotalTime
    plan.ok(otherTransactionTotalTimeMetric)
    plan.equal(otherTransactionAllMetric.callCount, 1)

    const otherTotalTimeBgTransactionName = 'OtherTransactionTotalTime/' + expectedTransactionName
    const otherTotalTimeBgTransactionNameMetric = unscopedMetrics[otherTotalTimeBgTransactionName]
    plan.ok(otherTotalTimeBgTransactionNameMetric)
    plan.equal(otherTotalTimeBgTransactionNameMetric.callCount, 1)
  }
})
