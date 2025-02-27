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

const helper = require('#testlib/agent_helper.js')
const AwsLambda = require('#agentlib/serverless/aws-lambda.js')
const lambdaSampleEvents = require('./lambda-sample-events')
const {
  DESTINATIONS: ATTR_DEST
} = require('#agentlib/transaction/index.js')

const validStreamMetaData = {
  statusCode: 200,
  headers: {
    'Content-Type': 'text/html',
    'X-Custom-Header': 'NewRelic-Test-Header'
  }
}

// Used by API Gateway response tests
const validResponse = {
  isBase64Encoded: false,
  statusCode: 200,
  headers: { responseHeader: 'headerValue' },
  body: 'a valid response string'
}

const groupName = 'Function'
const functionName = 'testNameStreaming'
const expectedTransactionName = groupName + '/' + functionName
const expectedBgTransactionName = 'OtherTransaction/' + expectedTransactionName
const expectedWebTransactionName = 'WebTransaction/' + expectedTransactionName
// const errorMessage = 'sad day'

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent({
    allow_all_headers: true,
    attributes: {
      exclude: ['request.headers.x*', 'response.headers.x*']
    },
    serverless_mode: { enabled: true }
  })

  const { request: responseStream } = createAwsResponseStream()
  ctx.nr.responseStream = responseStream

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
})

test.afterEach(async (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  if (ctx.nr.responseStream.writableFinished !== true) {
    ctx.nr.responseStream.destroy()
  }
})

/**
 * Creates a writable stream that simulates the stream actions AWS's Lambda
 * runtime expects when working with streamable handlers.
 *
 * @returns {Writable}
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

  stream.on('end', () => {
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
 * @returns {function} The same function, decorated with a symbol to indicate response streaming
 */
function decorateHandler(handler) {
  handler[Symbol.for('aws.lambda.runtime.handler.streaming')] = 'response'
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
 * @returns {Promise}
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

/**
 * AWS Lambda streaming responses have a specific structure. This class
 * replicates the internal tooling that AWS uses to construct said structure
 * when writing responses to the stream.
 *
 * @see https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/blob/db6a30da32934bcde91da248db30b60b17b891c4/src/HttpResponseStream.js
 */
class HttpResponseStream {
  static from(originalStream, prelude) {
    originalStream.setContentType('application/vnd.awslambda.http-integration-response')
    const streamMeta = JSON.stringify(prelude)
    originalStream._onBeforeFirstWrite = (write) => {
      // If we finish writing all of the required unit tests, and this assert
      // never gets triggered, then there is no reason to have this
      // `HttpResponseStream` thing.
      assert.fail('_onBeforeFirstWrite')
      write(streamMeta)
      write(new Uint8Array(0))
    }
    return originalStream
  }
}

test('should return original handler if not a function', (t) => {
  const handler = {}
  const newHandler = t.nr.awsLambda.patchLambdaHandler(handler)

  assert.equal(newHandler, handler)
})

test('should pick up on the arn', async (t) => {
  const { agent, awsLambda, event, responseStream, context } = t.nr
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(async () => {})
  const patched = awsLambda.patchLambdaHandler(handler)
  await patched(event, responseStream, context)
  assert.equal(agent.collector.metadata.arn, context.invokedFunctionArn)
})

test('when invoked with API Gateway Lambda proxy event', async (t) => {
  helper.unloadAgent(t.nr.agent)

  await t.test(
    'should not create web transaction for custom direct invocation payload',
    async (t) => {
      const plan = tspl(t, { plan: 8 })
      const { agent, awsLambda, responseStream, context } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const nonApiGatewayProxyEvent = {
        resource: {
          some: 'key'
        },
        action: 'someAction'
      }

      const handler = decorateHandler(async (event, responseStream, context) => {
        responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
        const chunks = ['first', 'second', 'third', 'fourth']
        await writeToResponseStream(chunks, responseStream, 500)

        const transaction = agent.tracer.getTransaction()
        plan.ok(transaction)
        plan.equal(transaction.type, 'bg')
        plan.equal(transaction.getFullName(), expectedBgTransactionName)
        plan.equal(transaction.isActive(), true)
        responseStream.end()
        return validResponse
      })

      const wrappedHandler = awsLambda.patchLambdaHandler(handler)
      await wrappedHandler(nonApiGatewayProxyEvent, responseStream, context)

      await plan

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        plan.equal(agentAttributes['request.method'], undefined)
        plan.equal(agentAttributes['request.uri'], undefined)

        plan.equal(spanAttributes['request.method'], undefined)
        plan.equal(spanAttributes['request.uri'], undefined)
      }
    }
  )

  await t.test('should create web transaction', async (t) => {
    const plan = tspl(t, { plan: 8 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream, context) => {
      responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
      const chunks = ['fifth', 'sixth', 'seventh', 'eighth']
      await writeToResponseStream(chunks, responseStream, 500)

      const transaction = agent.tracer.getTransaction()

      plan.ok(transaction)
      plan.equal(transaction.type, 'web')
      plan.equal(transaction.getFullName(), expectedWebTransactionName)
      plan.equal(transaction.isActive(), true)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      plan.equal(agentAttributes['request.method'], 'GET')
      plan.equal(agentAttributes['request.uri'], '/test/hello')

      plan.equal(spanAttributes['request.method'], 'GET')
      plan.equal(spanAttributes['request.uri'], '/test/hello')
    }
  })

  await t.test(
    'should set w3c tracecontext on transaction if present on request header',
    async (t) => {
      const plan = tspl(t, { plan: 2 })
      const { agent, awsLambda, responseStream, context } = t.nr
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `00-${expectedTraceId}-00f067aa0ba902b7-00`

      // transaction finished event passes back transaction,
      // so can't pass `done` in or will look like errored.
      agent.on('transactionFinished', () => {})

      agent.config.distributed_tracing.enabled = true

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
      apiGatewayProxyEvent.headers.traceparent = traceparent

      const handler = decorateHandler(async (event, responseStream, context) => {
        responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
        const chunks = ['tracecontext first', 'tracecontext second', 'tracecontext third', 'tracecontext fourth']
        await writeToResponseStream(chunks, responseStream, 500)

        const transaction = agent.tracer.getTransaction()

        const headers = {}
        transaction.insertDistributedTraceHeaders(headers)

        const traceParentFields = headers.traceparent.split('-')
        const [version, traceId] = traceParentFields

        plan.equal(version, '00')
        plan.equal(traceId, expectedTraceId)

        responseStream.end()
        return validResponse
      })

      const wrappedHandler = awsLambda.patchLambdaHandler(handler)
      await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

      await plan
    }
  )

  await t.test(
    'should add w3c tracecontext to transaction if not present on request header',
    async (t) => {
      const plan = tspl(t, { plan: 2 })
      const { agent, awsLambda, responseStream, context } = t.nr
      // transaction finished event passes back transaction,
      // so can't pass `done` in or will look like errored.
      agent.on('transactionFinished', () => {})

      agent.config.account_id = 'AccountId1'
      agent.config.primary_application_id = 'AppId1'
      agent.config.trusted_account_key = 33
      agent.config.distributed_tracing.enabled = true

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const handler = decorateHandler(async (event, responseStream, context) => {
        responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
        const chunks = ['1 add traceContext', '2 add traceContext', '3 add traceContext']
        await writeToResponseStream(chunks, responseStream, 500)

        const transaction = agent.tracer.getTransaction()

        const headers = {}
        transaction.insertDistributedTraceHeaders(headers)

        plan.ok(headers.traceparent)
        plan.ok(headers.tracestate)
        responseStream.end()
        return validResponse
      })

      const wrappedHandler = awsLambda.patchLambdaHandler(handler)
      await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

      await plan
    }
  )

  await t.test('should capture request parameters', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    agent.config.attributes.enabled = true
    agent.config.attributes.include = ['request.parameters.*']
    agent.config.emit('attributes.include')

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream, context) => {
      responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
      const chunks = ['capturing req params 1', 'capturing req params 2', 'capturing req params 3']
      await writeToResponseStream(chunks, responseStream, 500)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      plan.equal(agentAttributes['request.parameters.name'], 'me')
      plan.equal(agentAttributes['request.parameters.team'], 'node agent')
    }
  })

  await t.test('should capture request parameters in Span Attributes', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    agent.config.attributes.enabled = true
    agent.config.span_events.attributes.include = ['request.parameters.*']
    agent.config.emit('span_events.attributes.include')

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream, context) => {
      responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
      const chunks = ['params in spans 1', 'params in spans 2', 'params in spans 3']
      await writeToResponseStream(chunks, responseStream, 500)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan

    function confirmAgentAttribute(transaction) {
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      plan.equal(spanAttributes['request.parameters.name'], 'me')
      plan.equal(spanAttributes['request.parameters.team'], 'node agent')
    }
  })

  await t.test('should capture request headers', async (t) => {
    const plan = tspl(t, { plan: 13 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream, context) => {
      responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
      const chunks = ['capture headers 1', 'capture headers 2', 'capture headers 3']
      await writeToResponseStream(chunks, responseStream, 500)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      plan.equal(
        agentAttributes['request.headers.accept'],
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      )
      plan.equal(
        agentAttributes['request.headers.acceptEncoding'],
        'gzip, deflate, lzma, sdch, br'
      )
      plan.equal(agentAttributes['request.headers.acceptLanguage'], 'en-US,en;q=0.8')
      plan.equal(agentAttributes['request.headers.cloudFrontForwardedProto'], 'https')
      plan.equal(agentAttributes['request.headers.cloudFrontIsDesktopViewer'], 'true')
      plan.equal(agentAttributes['request.headers.cloudFrontIsMobileViewer'], 'false')
      plan.equal(agentAttributes['request.headers.cloudFrontIsSmartTVViewer'], 'false')
      plan.equal(agentAttributes['request.headers.cloudFrontIsTabletViewer'], 'false')
      plan.equal(agentAttributes['request.headers.cloudFrontViewerCountry'], 'US')
      plan.equal(
        agentAttributes['request.headers.host'],
        'wt6mne2s9k.execute-api.us-west-2.amazonaws.com'
      )
      plan.equal(agentAttributes['request.headers.upgradeInsecureRequests'], '1')
      plan.equal(
        agentAttributes['request.headers.userAgent'],
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6)'
      )
      plan.equal(
        agentAttributes['request.headers.via'],
        '1.1 fb7cca60f0ecd82ce07790c9c5eef16c.cloudfront.net (CloudFront)'
      )
    }
  })

  await t.test('should filter request headers by `exclude` rules', async (t) => {
    const plan = tspl(t, { plan: 12 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream, context) => {
      responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
      const chunks = ['filter by exclude 1', 'filter by exclude 2', 'filter by exclude 3']
      await writeToResponseStream(chunks, responseStream, 500)
      responseStream.end()
      return validResponse
    })
    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      plan.equal('request.headers.X-Amz-Cf-Id' in agentAttributes, false)
      plan.equal('request.headers.X-Forwarded-For' in agentAttributes, false)
      plan.equal('request.headers.X-Forwarded-Port' in agentAttributes, false)
      plan.equal('request.headers.X-Forwarded-Proto' in agentAttributes, false)

      plan.equal('request.headers.xAmzCfId' in agentAttributes, false)
      plan.equal('request.headers.xForwardedFor' in agentAttributes, false)
      plan.equal('request.headers.xForwardedPort' in agentAttributes, false)
      plan.equal('request.headers.xForwardedProto' in agentAttributes, false)

      plan.equal('request.headers.XAmzCfId' in agentAttributes, false)
      plan.equal('request.headers.XForwardedFor' in agentAttributes, false)
      plan.equal('request.headers.XForwardedPort' in agentAttributes, false)
      plan.equal('request.headers.XForwardedProto' in agentAttributes, false)
    }
  })

  await t.test('should capture status code', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream, context) => {
      responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
      const chunks = ['capture statusCode 1', 'capture statusCode 2', 'capture statusCode 3']
      await writeToResponseStream(chunks, responseStream, 500)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      plan.equal(agentAttributes['http.statusCode'], '200')
      plan.equal(spanAttributes['http.statusCode'], '200')
    }
  })
})
