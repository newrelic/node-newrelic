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
const lambdaSampleEvents = require('./lambda-sample-events')
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
    functionName: 'test_function',
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

test('should return original handler if not a function', (t) => {
  const handler = {}
  const newHandler = t.nr.awsLambda.patchLambdaHandler(handler)

  assert.equal(newHandler, handler)
})

test('should pick up on the arn', function (t) {
  const { agent, awsLambda, event, responseStream, context } = t.nr
  assert.equal(agent.collector.metadata.arn, null)

  const handler = decorateHandler(() => {})
  const patched = awsLambda.patchLambdaHandler(handler)
  patched(event, responseStream, context)
  assert.equal(agent.collector.metadata.arn, context.invokedFunctionArn)
})

test('when invoked with API Gateway Lambda proxy event', async (t) => {
  helper.unloadAgent(t.nr.agent)

  await t.test('should capture status code', (t, end) => {
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

    wrappedHandler(apiGatewayProxyEvent, responseStream, context)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      const segment = transaction.baseSegment
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes['http.statusCode'], '200')
      assert.equal(spanAttributes['http.statusCode'], '200')

      end()
    }
  })
})
