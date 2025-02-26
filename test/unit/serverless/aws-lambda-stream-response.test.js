/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const { setTimeout } = require('node:timers/promises')

const helper = require('#testlib/agent_helper.js')
const AwsLambda = require('#agentlib/serverless/aws-lambda.js')
// const lambdaSampleEvents = require('./lambda-sample-events')
const {
  DESTINATIONS: ATTR_DEST
} = require('#agentlib/transaction/index.js')
const {
  createAwsLambdaApiServer,
  createAwsResponseStream
} = require('#testlib/aws-server-stubs/lambda-streaming-response.js')

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
// const expectedWebTransactionName = 'WebTransaction/' + expectedTransactionName
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

  const { server, hostname, port } = await createAwsLambdaApiServer()
  const {
    request: responseStream
  } = createAwsResponseStream({ hostname, port })
  ctx.nr.server = server
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

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.close()
})

/**
 * Decorate the provided AWS Lambda handler in the manner AWS Lambda expects
 * streaming capable handlers to be decorated.
 *
 * @param {function} handler
 * @returns {function}
 */
function decorateHandler(handler) {
  handler[Symbol.for('aws.lambda.runtime.handler.streaming')] = 'response'
  return handler
}

/**
 * Writes a set of messages to the provided response stream in a delayed
 * manner in order to simulate a long-running response stream.
 *
 * @param {*[]} chunks
 * @param {object} stream
 * @param {number} delay
 *
 * @returns {Promise}
 */
function writeToResponseStream(chunks, stream, delay) {
  const writes = []
  for (const chunk of chunks) {
    const promise = setTimeout(() => {
      stream.write(chunk)
    }, delay)
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
      write(streamMeta)
      write(new Uint8Array(0))
    }
    return originalStream
  }
}

// test('should return original handler if not a function', (t) => {
//   const handler = {}
//   const newHandler = t.nr.awsLambda.patchLambdaHandler(handler)
//
//   assert.equal(newHandler, handler)
// })
//
// test('should pick up on the arn', function (t) {
//   const { agent, awsLambda, event, responseStream, context } = t.nr
//   assert.equal(agent.collector.metadata.arn, null)
//
//   const handler = decorateHandler(() => {})
//   const patched = awsLambda.patchLambdaHandler(handler)
//   patched(event, responseStream, context)
//   assert.equal(agent.collector.metadata.arn, context.invokedFunctionArn)
// })

test('when invoked with API Gateway Lambda proxy event', async (t) => {
  helper.unloadAgent(t.nr.agent)

  // await t.test('should capture status code', (t, end) => {
  //   const { agent, awsLambda, responseStream, context } = t.nr
  //   agent.on('transactionFinished', confirmAgentAttribute)
  //
  //   const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //
  //   const handler = decorateHandler(async (event, responseStream, context) => {
  //     responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //     const chunks = ['capture statusCode 1', 'capture statusCode 2', 'capture statusCode 3']
  //     await writeToResponseStream(chunks, responseStream, 500)
  //     responseStream.end()
  //     return validResponse
  //   })
  //   const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //
  //   wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //
  //   function confirmAgentAttribute(transaction) {
  //     const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
  //     const segment = transaction.baseSegment
  //     const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)
  //
  //     assert.equal(agentAttributes['http.statusCode'], '200')
  //     assert.equal(spanAttributes['http.statusCode'], '200')
  //
  //     end()
  //   }
  // })

  await t.test(
    'should not create web transaction for custom direct invocation payload',
    (t, end) => {
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
        assert.ok(transaction)
        assert.equal(transaction.type, 'bg')
        assert.equal(transaction.getFullName(), expectedBgTransactionName)
        assert.equal(transaction.isActive(), true)
        responseStream.end()
        return validResponse
      })

      const wrappedHandler = awsLambda.patchLambdaHandler(handler)
      wrappedHandler(nonApiGatewayProxyEvent, responseStream, context)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        assert.equal(agentAttributes['request.method'], undefined)
        assert.equal(agentAttributes['request.uri'], undefined)

        assert.equal(spanAttributes['request.method'], undefined)
        assert.equal(spanAttributes['request.uri'], undefined)

        end()
      }
    }
  )

  // await t.test('should create web transaction', (t, end) => {
  //   const { agent, awsLambda, responseStream, context } = t.nr
  //   agent.on('transactionFinished', confirmAgentAttribute)
  //
  //   const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //
  //   const handler = decorateHandler(async (event, responseStream, context) => {
  //     responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //     const chunks = ['fifth', 'sixth', 'seventh', 'eighth']
  //     await writeToResponseStream(chunks, responseStream, 500)
  //
  //     const transaction = agent.tracer.getTransaction()
  //
  //     assert.ok(transaction)
  //     assert.equal(transaction.type, 'web')
  //     assert.equal(transaction.getFullName(), expectedWebTransactionName)
  //     assert.equal(transaction.isActive(), true)
  //     responseStream.end()
  //     return validResponse
  //   })
  //
  //   const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //
  //   wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //
  //   function confirmAgentAttribute(transaction) {
  //     const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
  //     const segment = transaction.baseSegment
  //     const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)
  //
  //     assert.equal(agentAttributes['request.method'], 'GET')
  //     assert.equal(agentAttributes['request.uri'], '/test/hello')
  //
  //     assert.equal(spanAttributes['request.method'], 'GET')
  //     assert.equal(spanAttributes['request.uri'], '/test/hello')
  //
  //     end()
  //   }
  // })

  // await t.test(
  //   'should set w3c tracecontext on transaction if present on request header',
  //   (t, end) => {
  //     const { agent, awsLambda, responseStream, context } = t.nr
  //     const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
  //     const traceparent = `00-${expectedTraceId}-00f067aa0ba902b7-00`
  //
  //     // transaction finished event passes back transaction,
  //     // so can't pass `done` in or will look like errored.
  //     agent.on('transactionFinished', () => {
  //       end()
  //     })
  //
  //     agent.config.distributed_tracing.enabled = true
  //
  //     const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //     apiGatewayProxyEvent.headers.traceparent = traceparent
  //
  //     const handler = decorateHandler(async (event, responseStream, context) => {
  //       responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //       const chunks = ['tracecontext first', 'tracecontext second', 'tracecontext third', 'tracecontext fourth']
  //       await writeToResponseStream(chunks, responseStream, 500)
  //
  //       const transaction = agent.tracer.getTransaction()
  //
  //       const headers = {}
  //       transaction.insertDistributedTraceHeaders(headers)
  //
  //       const traceParentFields = headers.traceparent.split('-')
  //       const [version, traceId] = traceParentFields
  //
  //       assert.equal(version, '00')
  //       assert.equal(traceId, expectedTraceId)
  //
  //       responseStream.end()
  //       return validResponse
  //     })
  //
  //     const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //
  //     wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //   }
  // )
  //
  // await t.test(
  //   'should add w3c tracecontext to transaction if not present on request header',
  //   (t, end) => {
  //     const { agent, awsLambda, responseStream, context } = t.nr
  //     // transaction finished event passes back transaction,
  //     // so can't pass `done` in or will look like errored.
  //     agent.on('transactionFinished', () => {
  //       end()
  //     })
  //
  //     agent.config.account_id = 'AccountId1'
  //     agent.config.primary_application_id = 'AppId1'
  //     agent.config.trusted_account_key = 33
  //     agent.config.distributed_tracing.enabled = true
  //
  //     const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //
  //     const handler = decorateHandler(async (event, responseStream, context) => {
  //       responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //       const chunks = ['1 add traceContext', '2 add traceContext', '3 add traceContext']
  //       await writeToResponseStream(chunks, responseStream, 500)
  //
  //       const transaction = agent.tracer.getTransaction()
  //
  //       const headers = {}
  //       transaction.insertDistributedTraceHeaders(headers)
  //
  //       assert.ok(headers.traceparent)
  //       assert.ok(headers.tracestate)
  //       responseStream.end()
  //       return validResponse
  //     })
  //
  //     const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //
  //     wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //   }
  // )
  //
  // await t.test('should capture request parameters', (t, end) => {
  //   const { agent, awsLambda, responseStream, context } = t.nr
  //   agent.on('transactionFinished', confirmAgentAttribute)
  //
  //   agent.config.attributes.enabled = true
  //   agent.config.attributes.include = ['request.parameters.*']
  //   agent.config.emit('attributes.include')
  //
  //   const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //
  //   const handler = decorateHandler(async (event, responseStream, context) => {
  //     responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //     const chunks = ['capturing req params 1', 'capturing req params 2', 'capturing req params 3']
  //     await writeToResponseStream(chunks, responseStream, 500)
  //     responseStream.end()
  //     return validResponse
  //   })
  //
  //   const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //   wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //
  //   function confirmAgentAttribute(transaction) {
  //     const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
  //
  //     assert.equal(agentAttributes['request.parameters.name'], 'me')
  //     assert.equal(agentAttributes['request.parameters.team'], 'node agent')
  //
  //     end()
  //   }
  // })
  //
  // await t.test('should capture request parameters in Span Attributes', (t, end) => {
  //   const { agent, awsLambda, responseStream, context } = t.nr
  //   agent.on('transactionFinished', confirmAgentAttribute)
  //
  //   agent.config.attributes.enabled = true
  //   agent.config.span_events.attributes.include = ['request.parameters.*']
  //   agent.config.emit('span_events.attributes.include')
  //
  //   const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //
  //   const handler = decorateHandler(async (event, responseStream, context) => {
  //     responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //     const chunks = ['params in spans 1', 'params in spans 2', 'params in spans 3']
  //     await writeToResponseStream(chunks, responseStream, 500)
  //     responseStream.end()
  //   })
  //
  //   const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //
  //   wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //
  //   function confirmAgentAttribute(transaction) {
  //     const segment = transaction.baseSegment
  //     const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)
  //
  //     assert.equal(spanAttributes['request.parameters.name'], 'me')
  //     assert.equal(spanAttributes['request.parameters.team'], 'node agent')
  //
  //     end()
  //   }
  // })
  //
  // await t.test('should capture request headers', (t, end) => {
  //   const { agent, awsLambda, responseStream, context } = t.nr
  //   agent.on('transactionFinished', confirmAgentAttribute)
  //
  //   const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //
  //   const handler = decorateHandler(async (event, responseStream, context) => {
  //     responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //     const chunks = ['capture headers 1', 'capture headers 2', 'capture headers 3']
  //     await writeToResponseStream(chunks, responseStream, 500)
  //     responseStream.end()
  //   })
  //
  //   const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //
  //   wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //
  //   function confirmAgentAttribute(transaction) {
  //     const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
  //
  //     assert.equal(
  //       agentAttributes['request.headers.accept'],
  //       'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  //     )
  //     assert.equal(
  //       agentAttributes['request.headers.acceptEncoding'],
  //       'gzip, deflate, lzma, sdch, br'
  //     )
  //     assert.equal(agentAttributes['request.headers.acceptLanguage'], 'en-US,en;q=0.8')
  //     assert.equal(agentAttributes['request.headers.cloudFrontForwardedProto'], 'https')
  //     assert.equal(agentAttributes['request.headers.cloudFrontIsDesktopViewer'], 'true')
  //     assert.equal(agentAttributes['request.headers.cloudFrontIsMobileViewer'], 'false')
  //     assert.equal(agentAttributes['request.headers.cloudFrontIsSmartTVViewer'], 'false')
  //     assert.equal(agentAttributes['request.headers.cloudFrontIsTabletViewer'], 'false')
  //     assert.equal(agentAttributes['request.headers.cloudFrontViewerCountry'], 'US')
  //     assert.equal(
  //       agentAttributes['request.headers.host'],
  //       'wt6mne2s9k.execute-api.us-west-2.amazonaws.com'
  //     )
  //     assert.equal(agentAttributes['request.headers.upgradeInsecureRequests'], '1')
  //     assert.equal(
  //       agentAttributes['request.headers.userAgent'],
  //       'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6)'
  //     )
  //     assert.equal(
  //       agentAttributes['request.headers.via'],
  //       '1.1 fb7cca60f0ecd82ce07790c9c5eef16c.cloudfront.net (CloudFront)'
  //     )
  //
  //     end()
  //   }
  // })
  //
  // await t.test('should filter request headers by `exclude` rules', (t, end) => {
  //   const { agent, awsLambda, responseStream, context } = t.nr
  //   agent.on('transactionFinished', confirmAgentAttribute)
  //
  //   const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
  //
  //   const handler = decorateHandler(async (event, responseStream, context) => {
  //     responseStream = HttpResponseStream.from(responseStream, validStreamMetaData)
  //     const chunks = ['filter by exclude 1', 'filter by exclude 2', 'filter by exclude 3']
  //     const stream = await writeToResponseStream(chunks, responseStream, 500)
  //     stream.end()
  //   })
  //   const wrappedHandler = awsLambda.patchLambdaHandler(handler)
  //
  //   wrappedHandler(apiGatewayProxyEvent, responseStream, context)
  //
  //   function confirmAgentAttribute(transaction) {
  //     const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
  //
  //     assert.equal('request.headers.X-Amz-Cf-Id' in agentAttributes, false)
  //     assert.equal('request.headers.X-Forwarded-For' in agentAttributes, false)
  //     assert.equal('request.headers.X-Forwarded-Port' in agentAttributes, false)
  //     assert.equal('request.headers.X-Forwarded-Proto' in agentAttributes, false)
  //
  //     assert.equal('request.headers.xAmzCfId' in agentAttributes, false)
  //     assert.equal('request.headers.xForwardedFor' in agentAttributes, false)
  //     assert.equal('request.headers.xForwardedPort' in agentAttributes, false)
  //     assert.equal('request.headers.xForwardedProto' in agentAttributes, false)
  //
  //     assert.equal('request.headers.XAmzCfId' in agentAttributes, false)
  //     assert.equal('request.headers.XForwardedFor' in agentAttributes, false)
  //     assert.equal('request.headers.XForwardedPort' in agentAttributes, false)
  //     assert.equal('request.headers.XForwardedProto' in agentAttributes, false)
  //
  //     end()
  //   }
  // })
})
