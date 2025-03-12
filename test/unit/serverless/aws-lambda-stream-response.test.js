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
const tempRemoveListeners = require('../../lib/temp-remove-listeners')
const tempOverrideUncaught = require('../../lib/temp-override-uncaught')
const AwsLambda = require('#agentlib/serverless/aws-lambda.js')
const lambdaSampleEvents = require('./lambda-sample-events')
const {
  DESTINATIONS: ATTR_DEST
} = require('#agentlib/transaction/index.js')

// Used by API Gateway response tests
const validResponse = {
  isBase64Encoded: false,
  statusCode: 200,
  headers: { responseHeader: 'NewRelic-Test-Header' },
  body: 'a valid response string'
}

const groupName = 'Function'
const functionName = 'testNameStreaming'
const expectedTransactionName = groupName + '/' + functionName
const expectedBgTransactionName = 'OtherTransaction/' + expectedTransactionName
const expectedWebTransactionName = 'WebTransaction/' + expectedTransactionName
const errorMessage = 'sad day'
// Attribute key names:
const REQ_ID = 'aws.requestId'
const LAMBDA_ARN = 'aws.lambda.arn'
const COLDSTART = 'aws.lambda.coldStart'
const EVENTSOURCE_ARN = 'aws.lambda.eventSource.arn'
const EVENTSOURCE_TYPE = 'aws.lambda.eventSource.eventType'

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
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(async () => {})
  const patched = awsLambda.patchLambdaHandler(handler)
  assert.ok(patched[Symbol.for('aws.lambda.runtime.handler.streaming')])
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
    const endListeners = responseStream.listeners('end')
    const errorListeners = responseStream.listeners('error')
    assert.ok(endListeners.length === 2)
    assert.ok(errorListeners.length === 2)
    assert.ok(endListeners[1].toString().indexOf('txnEnder') > -1, 'the agent should set a transaction ender on stream end')
    assert.ok(errorListeners[1].toString().indexOf('shim') > -1, 'the agent should listen for stream errors')
  })
  const patched = awsLambda.patchLambdaHandler(handler)
  await patched(event, responseStream, context)
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

      const handler = decorateHandler(async (event, responseStream) => {
        const chunks = ['first', 'second', 'third', 'fourth']
        await writeToResponseStream(chunks, responseStream, 100)

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

      await plan.completed

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

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['fifth', 'sixth', 'seventh', 'eighth']
      await writeToResponseStream(chunks, responseStream, 100)

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

    await plan.completed

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

      const handler = decorateHandler(async (event, responseStream) => {
        const chunks = ['tracecontext first', 'tracecontext second', 'tracecontext third', 'tracecontext fourth']
        await writeToResponseStream(chunks, responseStream, 100)

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

      await plan.completed
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

      const handler = decorateHandler(async (event, responseStream) => {
        const chunks = ['1 add traceContext', '2 add traceContext', '3 add traceContext']
        await writeToResponseStream(chunks, responseStream, 100)

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

      await plan.completed
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

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['capturing req params 1', 'capturing req params 2', 'capturing req params 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

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

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['params in spans 1', 'params in spans 2', 'params in spans 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

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

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['capture headers 1', 'capture headers 2', 'capture headers 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

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

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['filter by exclude 1', 'filter by exclude 2', 'filter by exclude 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })
    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

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

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['capture statusCode 1', 'capture statusCode 2', 'capture statusCode 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)
    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      plan.equal(agentAttributes['http.statusCode'], '200')
      plan.equal(spanAttributes['http.statusCode'], '200')
    }
  })

  await t.test('should capture response status code in async lambda', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['capture statusCode 1', 'capture statusCode 2', 'capture statusCode 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })
    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

    // eslint-disable-next-line sonarjs/no-identical-functions
    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      plan.equal(agentAttributes['http.statusCode'], '200')
      plan.equal(spanAttributes['http.statusCode'], '200')
    }
  })

  /// started here
  await t.test('should capture response headers', async (t) => {
    const plan = tspl(t, { plan: 1 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      plan.equal(agentAttributes['response.headers.responseHeader'], 'NewRelic-Test-Header')
    }
  })

  await t.test('should work when responding without headers', async (t) => {
    const plan = tspl(t, { plan: 1 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['no headers 1', 'no headers 2', 'no headers 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return {
        isBase64Encoded: false,
        statusCode: 200,
        body: 'a valid response string'
      }
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      plan.equal(agentAttributes['http.statusCode'], '200')
    }
  })

  await t.test('should detect event type', async (t) => {
    const plan = tspl(t, { plan: 1 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'apiGateway')
    }
  })

  await t.test('should collect event source meta data', async (t) => {
    const plan = tspl(t, { plan: 10 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      plan.equal(agentAttributes['aws.lambda.eventSource.accountId'], '123456789012')
      plan.equal(agentAttributes['aws.lambda.eventSource.apiId'], 'wt6mne2s9k')
      plan.equal(agentAttributes['aws.lambda.eventSource.resourceId'], 'us4z18')
      plan.equal(agentAttributes['aws.lambda.eventSource.resourcePath'], '/{proxy+}')
      plan.equal(agentAttributes['aws.lambda.eventSource.stage'], 'test')

      plan.equal(spanAttributes['aws.lambda.eventSource.accountId'], '123456789012')
      plan.equal(spanAttributes['aws.lambda.eventSource.apiId'], 'wt6mne2s9k')
      plan.equal(spanAttributes['aws.lambda.eventSource.resourceId'], 'us4z18')
      plan.equal(spanAttributes['aws.lambda.eventSource.resourcePath'], '/{proxy+}')
      plan.equal(spanAttributes['aws.lambda.eventSource.stage'], 'test')
    }
  })

  await t.test('should record standard web metrics', async (t) => {
    const plan = tspl(t, { plan: 15 })
    const { agent, awsLambda, responseStream, context } = t.nr
    agent.on('harvestStarted', confirmMetrics)

    const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const handler = decorateHandler(async (event, responseStream) => {
      const chunks = ['step 1', 'step 2', 'step 3']
      // delay set to 10ms here so that Apdex is "satisfying" instead of "tolerating"
      await writeToResponseStream(chunks, responseStream, 10)
      responseStream.end()
      return validResponse
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    await plan.completed

    function confirmMetrics() {
      const unscopedMetrics = getMetrics(agent).unscoped
      plan.ok(unscopedMetrics)

      plan.ok(unscopedMetrics.HttpDispatcher)
      plan.equal(unscopedMetrics.HttpDispatcher.callCount, 1)

      plan.ok(unscopedMetrics.Apdex)
      plan.equal(unscopedMetrics.Apdex.satisfying, 1)

      const transactionApdex = 'Apdex/' + expectedTransactionName
      plan.ok(unscopedMetrics[transactionApdex])
      plan.equal(unscopedMetrics[transactionApdex].satisfying, 1)

      plan.ok(unscopedMetrics.WebTransaction)
      plan.equal(unscopedMetrics.WebTransaction.callCount, 1)

      plan.ok(unscopedMetrics[expectedWebTransactionName])
      plan.equal(unscopedMetrics[expectedWebTransactionName].callCount, 1)

      plan.ok(unscopedMetrics.WebTransactionTotalTime)
      plan.equal(unscopedMetrics.WebTransactionTotalTime.callCount, 1)

      const transactionWebTotalTime = 'WebTransactionTotalTime/' + expectedTransactionName
      plan.ok(unscopedMetrics[transactionWebTotalTime])
      plan.equal(unscopedMetrics[transactionWebTotalTime].callCount, 1)
    }
  })
})

test('should create a segment for handler', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { awsLambda, event, responseStream, context } = t.nr
  const handler = decorateHandler(async (event, responseStream) => {
    const segment = awsLambda.shim.getSegment()
    plan.notEqual(segment, null)
    plan.equal(segment.name, functionName)
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed
})

test('should capture cold start boolean on first invocation', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmColdStart)

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)

  await plan.completed

  function confirmColdStart(transaction) {
    const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
    plan.equal(attributes['aws.lambda.coldStart'], true)
  }
})

test('should not include cold start on subsequent invocations', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
  let transactionNum = 1

  agent.on('transactionFinished', confirmNoAdditionalColdStart)

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmNoAdditionalColdStart(transaction) {
    if (transactionNum > 1) {
      const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)
      plan.equal('aws.lambda.coldStart' in attributes, false)
      plan.equal('aws.lambda.coldStart' in spanAttributes, false)
    }

    transactionNum++
  }
})

test('should capture AWS agent attributes and send to correct dests', async (t) => {
  const plan = tspl(t, { plan: 15 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttributes)

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  const stubEvt = {
    Records: [{ eventSourceARN: 'stub:eventsource:arn' }]
  }

  await wrappedHandler(stubEvt, responseStream, context)
  await plan.completed

  function confirmAgentAttributes(transaction) {
    // verify attributes exist in correct destinations
    const txTrace = _verifyDestinations(transaction)

    // now verify actual values
    plan.equal(txTrace[REQ_ID], context.awsRequestId)
    plan.equal(txTrace[LAMBDA_ARN], context.invokedFunctionArn)
    plan.equal(txTrace[COLDSTART], true)
  }

  function _verifyDestinations(tx) {
    const txTrace = tx.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const errEvent = tx.trace.attributes.get(ATTR_DEST.ERROR_EVENT)
    const txEvent = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

    const all = [REQ_ID, LAMBDA_ARN, COLDSTART, EVENTSOURCE_ARN]

    all.forEach((key) => {
      plan.notEqual(txTrace[key], undefined)
      plan.notEqual(errEvent[key], undefined)
      plan.notEqual(txEvent[key], undefined)
    })

    return txTrace
  }
})

test('should not add attributes from empty event', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(EVENTSOURCE_ARN in agentAttributes, false)
    plan.equal(EVENTSOURCE_TYPE in agentAttributes, false)
    plan.equal(EVENTSOURCE_ARN in spanAttributes, false)
    plan.equal(EVENTSOURCE_TYPE in spanAttributes, false)
  }
})

test('should capture kinesis data stream event source arn', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.kinesisDataStreamEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes[EVENTSOURCE_ARN], 'kinesis:eventsourcearn')
    plan.equal(spanAttributes[EVENTSOURCE_ARN], 'kinesis:eventsourcearn')
    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'kinesis')
    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'kinesis')
  }
})

test('should capture S3 PUT event source arn attribute', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.s3PutEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes[EVENTSOURCE_ARN], 'bucketarn')
    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 's3')

    plan.equal(spanAttributes[EVENTSOURCE_ARN], 'bucketarn')
    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 's3')
  }
})

test('should capture SNS event source arn attribute', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.snsEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes[EVENTSOURCE_ARN], 'eventsubscriptionarn')
    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'sns')

    plan.equal(spanAttributes[EVENTSOURCE_ARN], 'eventsubscriptionarn')
    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'sns')
  }
})

test('should capture DynamoDB Update event source attribute', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.dynamoDbUpdateEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes[EVENTSOURCE_ARN], 'dynamodb:eventsourcearn')
    plan.equal(spanAttributes[EVENTSOURCE_ARN], 'dynamodb:eventsourcearn')
  }
})

test('should capture CodeCommit event source attribute', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.codeCommitEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(
      agentAttributes[EVENTSOURCE_ARN],
      'arn:aws:codecommit:us-west-2:123456789012:my-repo'
    )
    plan.equal(
      spanAttributes[EVENTSOURCE_ARN],
      'arn:aws:codecommit:us-west-2:123456789012:my-repo'
    )
  }
})

test('should not capture unknown event source attribute', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.cloudFrontEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes[EVENTSOURCE_ARN], undefined)
    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'cloudFront')
    plan.equal(spanAttributes[EVENTSOURCE_ARN], undefined)
    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'cloudFront')
  }
})

test('should capture Kinesis Data Firehose event source attribute', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.kinesisDataFirehoseEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes[EVENTSOURCE_ARN], 'aws:lambda:events')
    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'firehose')

    plan.equal(spanAttributes[EVENTSOURCE_ARN], 'aws:lambda:events')
    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'firehose')
  }
})

test('should capture ALB event type', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.albEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(
      agentAttributes[EVENTSOURCE_ARN],
      'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
    )

    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'alb')

    plan.equal(
      spanAttributes[EVENTSOURCE_ARN],
      'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
    )

    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'alb')
  }
})

test('should capture CloudWatch Scheduled event type', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.cloudwatchScheduled

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(
      agentAttributes[EVENTSOURCE_ARN],
      'arn:aws:events:us-west-2:123456789012:rule/ExampleRule'
    )
    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'cloudWatch_scheduled')

    plan.equal(
      spanAttributes[EVENTSOURCE_ARN],
      'arn:aws:events:us-west-2:123456789012:rule/ExampleRule'
    )
    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'cloudWatch_scheduled')
  }
})

test('should capture SES event type', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  const event = lambdaSampleEvents.sesEvent

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'ses')
    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'ses')
  }
})

test('should capture ALB event type with multi value parameters', async (t) => {
  const plan = tspl(t, { plan: 7 })
  const { agent, awsLambda, responseStream, context } = t.nr
  agent.on('transactionFinished', confirmAgentAttribute)

  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  const event = lambdaSampleEvents.albEventWithMultiValueParameters

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  }
  )

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
  await plan.completed

  function confirmAgentAttribute(transaction) {
    const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
    const segment = transaction.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(
      agentAttributes[EVENTSOURCE_ARN],
      'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
    )

    plan.equal(agentAttributes[EVENTSOURCE_TYPE], 'alb')

    plan.equal(agentAttributes['request.method'], 'GET')

    // validate that multi value query string parameters are normalized to comma seperated strings
    plan.equal(agentAttributes['request.parameters.query'], '1234ABCD,other')

    plan.equal(
      spanAttributes[EVENTSOURCE_ARN],
      'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
    )

    plan.equal(spanAttributes[EVENTSOURCE_TYPE], 'alb')

    // validate that multi value headers are normalized to comma seperated strings
    plan.equal(
      spanAttributes['request.headers.setCookie'],
      'cookie-name=cookie-value;Domain=myweb.com;Secure;HttpOnly,cookie-name=cookie-other-value'
    )
  }
})

test('when context.done used', async (t) => {
  helper.unloadAgent(t.nr.agent)

  await t.test('should end appropriately', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, awsLambda, event, responseStream, context } = t.nr
    let transaction

    context.done = confirmEndStream

    const handler = decorateHandler(async (event, responseStream, context) => {
      transaction = agent.tracer.getTransaction()
      context.done(null, 'worked')
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(event, responseStream, context)
    await plan.completed

    function confirmEndStream() {
      plan.equal(transaction.isActive(), false)

      const currentTransaction = agent.tracer.getTransaction()
      plan.equal(currentTransaction, null)
    }
  })

  await t.test('should notice errors', async (t) => {
    const plan = tspl(t, { plan: 4 })
    const { agent, awsLambda, error, event, responseStream, context } = t.nr
    agent.on('harvestStarted', function confirmErrorCapture() {
      plan.equal(agent.errors.traceAggregator.errors.length, 1)
      const noticedError = agent.errors.traceAggregator.errors[0]
      plan.equal(noticedError[1], expectedBgTransactionName)
      plan.equal(noticedError[2], errorMessage)
      plan.equal(noticedError[3], 'SyntaxError')
    })

    const handler = decorateHandler(async (event, responseStream, context) => {
      context.done(error, 'failed')
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(event, responseStream, context)
    await plan.completed
  })

  await t.test('should notice string errors', async (t) => {
    const plan = tspl(t, { plan: 5 })
    const { agent, awsLambda, event, responseStream, context } = t.nr
    agent.on('harvestStarted', function confirmErrorCapture() {
      plan.equal(agent.errors.traceAggregator.errors.length, 1)
      const noticedError = agent.errors.traceAggregator.errors[0]
      plan.equal(noticedError[1], expectedBgTransactionName)
      plan.equal(noticedError[2], 'failed')
      plan.equal(noticedError[3], 'Error')

      const data = noticedError[4]
      plan.ok(data.stack_trace)
    })

    const handler = decorateHandler(async (event, responseStream, context) => {
      context.done('failed')
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(event, responseStream, context)
    await plan.completed
  })
})

test('when context.succeed used', async (t) => {
  helper.unloadAgent(t.nr.agent)

  await t.test('should end appropriately', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, awsLambda, event, responseStream, context } = t.nr
    let transaction

    context.succeed = function confirmEndCallback() {
      plan.equal(transaction.isActive(), false)

      const currentTransaction = agent.tracer.getTransaction()
      plan.equal(currentTransaction, null)
    }

    const handler = decorateHandler(async (event, responseStream, context) => {
      transaction = agent.tracer.getTransaction()
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      context.succeed('worked')
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(event, responseStream, context)
    await plan.completed
  })
})

test('when context.fail used', async (t) => {
  helper.unloadAgent(t.nr.agent)

  await t.test('should end appropriately', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, awsLambda, event, responseStream, context } = t.nr
    let transaction

    context.fail = function confirmEndCallback() {
      plan.equal(transaction.isActive(), false)

      const currentTransaction = agent.tracer.getTransaction()
      plan.equal(currentTransaction, null)
    }

    const handler = decorateHandler(async (event, responseStream, context) => {
      transaction = agent.tracer.getTransaction()
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return context.fail()
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(event, responseStream, context)
    await plan.completed
  })

  await t.test('should notice errors', async (t) => {
    const plan = tspl(t, { plan: 4 })
    const { agent, awsLambda, error, event, responseStream, context } = t.nr
    agent.on('harvestStarted', function confirmErrorCapture() {
      plan.equal(agent.errors.traceAggregator.errors.length, 1)
      const noticedError = agent.errors.traceAggregator.errors[0]
      plan.equal(noticedError[1], expectedBgTransactionName)
      plan.equal(noticedError[2], errorMessage)
      plan.equal(noticedError[3], 'SyntaxError')
    })

    const handler = decorateHandler(async (event, responseStream, context) => {
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return context.fail(error)
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(event, responseStream, context)
    await plan.completed
  })

  await t.test('should notice string errors', async (t) => {
    const plan = tspl(t, { plan: 5 })
    const { agent, awsLambda, event, responseStream, context } = t.nr
    agent.on('harvestStarted', function confirmErrorCapture() {
      plan.equal(agent.errors.traceAggregator.errors.length, 1)
      const noticedError = agent.errors.traceAggregator.errors[0]
      plan.equal(noticedError[1], expectedBgTransactionName)
      plan.equal(noticedError[2], 'failed')
      plan.equal(noticedError[3], 'Error')

      const data = noticedError[4]
      plan.ok(data.stack_trace)
    })

    const handler = decorateHandler(async (event, responseStream, context) => {
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      return context.fail('failed')
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    await wrappedHandler(event, responseStream, context)
    await plan.completed
  })
})

test('should create a transaction for handler', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
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
  await plan.completed
})

test('should end transactions on a beforeExit event on process', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
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
  await plan.completed
})

test('should end transactions after the returned promise resolves', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
  let transaction

  const handler = decorateHandler(async (event, responseStream) => {
    transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return new Promise((resolve) => {
      plan.ok(transaction)
      plan.equal(transaction.type, 'bg')
      plan.equal(transaction.getFullName(), expectedBgTransactionName)
      plan.ok(transaction.isActive())

      return resolve('hello')
    })
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  const value = await wrappedHandler(event, responseStream, context)
  plan.equal(value, 'hello')
  plan.equal(transaction.isActive(), false)
  await plan.completed
})

test('should record error event when func is async and promise is rejected', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, awsLambda, error, event, responseStream, context } = t.nr
  agent.on('harvestStarted', confirmErrorCapture)

  let transaction
  const handler = decorateHandler(async (event, responseStream) => {
    transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return new Promise((resolve, reject) => {
      plan.ok(transaction)
      plan.equal(transaction.type, 'bg')
      plan.equal(transaction.getFullName(), expectedBgTransactionName)
      plan.ok(transaction.isActive())

      reject(error)
    })
  })
  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  try {
    await wrappedHandler(event, responseStream, context)
  } catch (err) {
    plan.equal(err, error)
    plan.equal(transaction.isActive(), false)
  }
  await plan.completed

  function confirmErrorCapture() {
    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 1)

    const noticedError = errors[0]
    const [, transactionName, message, type] = noticedError
    plan.equal(transactionName, expectedBgTransactionName)
    plan.equal(message, errorMessage)
    plan.equal(type, 'SyntaxError')
  }
})

test('should record error event when func is async and error is thrown', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, awsLambda, error, event, responseStream, context } = t.nr
  agent.on('harvestStarted', function confirmErrorCapture() {
    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 1)

    const noticedError = errors[0]
    const [, transactionName, message, type] = noticedError
    plan.equal(transactionName, expectedBgTransactionName)
    plan.equal(message, errorMessage)
    plan.equal(type, 'SyntaxError')
  })

  let transaction
  const handler = decorateHandler(async (event, responseStream) => {
    transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return new Promise(() => {
      plan.ok(transaction)
      plan.equal(transaction.type, 'bg')
      plan.equal(transaction.getFullName(), expectedBgTransactionName)
      plan.ok(transaction.isActive())

      throw error
    })
  })
  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  try {
    await wrappedHandler(event, responseStream, context)
  } catch (err) {
    plan.equal(err, error)
    plan.equal(transaction.isActive(), false)
  }
  await plan.completed
})

test(
  'should record error event when func is async an UnhandledPromiseRejection is thrown',
  async (t) => {
    const plan = tspl(t, { plan: 10 })
    const { agent, awsLambda, error, event, responseStream, context } = t.nr
    // this and a few other tests harvest more than once.
    // since we are using plan based testing im only asserting the first harvest
    agent.on('harvestStarted', function confirmErrorCapture() {
      const errors = agent.errors.traceAggregator.errors
      plan.equal(errors.length, 1)

      const noticedError = errors[0]
      const [, transactionName, message, type] = noticedError
      plan.equal(transactionName, expectedBgTransactionName)
      plan.equal(message, errorMessage)
      plan.equal(type, 'SyntaxError')
    })

    let transaction
    const handler = decorateHandler(async (event, responseStream) => {
      transaction = agent.tracer.getTransaction()
      const chunks = ['step 1', 'step 2', 'step 3']
      await writeToResponseStream(chunks, responseStream, 100)
      responseStream.end()
      // We need this promise to evaluate out-of-band in order to test the
      // correct scenario.
      // eslint-disable-next-line no-new
      new Promise(() => {
        plan.ok(transaction)
        plan.equal(transaction.type, 'bg')
        plan.equal(transaction.getFullName(), expectedBgTransactionName)
        plan.ok(transaction.isActive())

        throw error
      })

      await new Promise((resolve) => setTimeout(resolve, 1))
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(handler)

    tempOverrideUncaught({
      t,
      type: tempOverrideUncaught.REJECTION,
      handler(err) {
        plan.equal(err, error)
        plan.equal(transaction.isActive(), false)
      }
    })

    await wrappedHandler(event, responseStream, context)
    await plan.completed
  }
)

test('should record error event when error is thrown', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent, awsLambda, error, event, responseStream, context } = t.nr

  agent.on('harvestStarted', function confirmErrorCapture() {
    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 1)

    const noticedError = errors[0]
    const [, transactionName, message, type] = noticedError
    plan.equal(transactionName, expectedBgTransactionName)
    plan.equal(message, errorMessage)
    plan.equal(type, 'SyntaxError')
  })

  const handler = decorateHandler(async (event, responseStream) => {
    const transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    plan.ok(transaction)
    plan.equal(transaction.type, 'bg')
    plan.equal(transaction.getFullName(), expectedBgTransactionName)
    plan.ok(transaction.isActive())

    throw error
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  try {
    await wrappedHandler(event, responseStream, context)
  } catch (error) {
    if (error.name !== 'SyntaxError') {
      throw error
    }
  }
  await plan.completed
})

test('should not end transactions twice', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
  let transaction

  const handler = decorateHandler(async (event, responseStream) => {
    transaction = agent.tracer.getTransaction()
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()

    let called = false
    const oldEnd = transaction.end
    transaction.end = function wrappedEnd() {
      if (called) {
        throw new Error('called end on the same transaction twice')
      }
      called = true
      return oldEnd.apply(transaction, arguments)
    }

    return new Promise((resolve) => {
      plan.ok(transaction)
      plan.equal(transaction.type, 'bg')
      plan.equal(transaction.getFullName(), expectedBgTransactionName)
      plan.ok(transaction.isActive())
      responseStream.end()
      resolve('hello')
    })
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  const value = await wrappedHandler(event, responseStream, context)
  plan.equal(value, 'hello')
  plan.equal(transaction.isActive(), false)
  await plan.completed
})

test('should record standard background metrics', async (t) => {
  const plan = tspl(t, { plan: 9 })
  const { agent, awsLambda, event, responseStream, context } = t.nr
  agent.on('harvestStarted', confirmMetrics)

  const handler = decorateHandler(async (event, responseStream) => {
    const chunks = ['step 1', 'step 2', 'step 3']
    await writeToResponseStream(chunks, responseStream, 100)
    responseStream.end()
    return validResponse
  })

  const wrappedHandler = awsLambda.patchLambdaHandler(handler)

  await wrappedHandler(event, responseStream, context)
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
