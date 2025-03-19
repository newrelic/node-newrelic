/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const sinon = require('sinon')

const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const tempRemoveListeners = require('../../lib/temp-remove-listeners')
const tempOverrideUncaught = require('../../lib/temp-override-uncaught')
const AwsLambda = require('../../../lib/serverless/aws-lambda')
const lambdaSampleEvents = require('./lambda-sample-events')

const { DESTINATIONS: ATTR_DEST } = require('../../../lib/config/attribute-filter')
const symbols = require('../../../lib/symbols')

// Attribute key names:
const REQ_ID = 'aws.requestId'
const LAMBDA_ARN = 'aws.lambda.arn'
const COLDSTART = 'aws.lambda.coldStart'
const EVENTSOURCE_ARN = 'aws.lambda.eventSource.arn'
const EVENTSOURCE_TYPE = 'aws.lambda.eventSource.eventType'

function getMetrics(agent) {
  return agent.metrics._metrics
}

test('AwsLambda.patchLambdaHandler', async (t) => {
  const groupName = 'Function'
  const functionName = 'testName'
  const expectedTransactionName = groupName + '/' + functionName
  const expectedBgTransactionName = 'OtherTransaction/' + expectedTransactionName
  const expectedWebTransactionName = 'WebTransaction/' + expectedTransactionName
  const errorMessage = 'sad day'

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      allow_all_headers: true,
      attributes: {
        exclude: ['request.headers.x*', 'response.headers.x*']
      },
      serverless_mode: { enabled: true }
    })

    process.env.NEWRELIC_PIPE_PATH = os.devNull
    const awsLambda = new AwsLambda(ctx.nr.agent)
    ctx.nr.awsLambda = awsLambda
    awsLambda._resetModuleState()

    ctx.nr.stubEvent = {}
    ctx.nr.stubContext = {
      done() {},
      succeed() {},
      fail() {},
      functionName,
      functionVersion: 'TestVersion',
      invokedFunctionArn: 'arn:test:function',
      memoryLimitInMB: '128',
      awsRequestId: 'testid'
    }
    ctx.nr.stubCallback = () => {}

    process.env.AWS_EXECUTION_ENV = 'Test_nodejsNegative2.3'

    ctx.nr.error = new SyntaxError(errorMessage)

    ctx.nr.agent.setState('started')
  })

  t.afterEach((ctx) => {
    delete process.env.AWS_EXECUTION_ENV
    helper.unloadAgent(ctx.nr.agent)

    if (process.emit && process.emit[symbols.unwrap]) {
      process.emit[symbols.unwrap]()
    }
  })

  await t.test('should return original handler if not a function', (t) => {
    const handler = {}
    const newHandler = t.nr.awsLambda.patchLambdaHandler(handler)

    assert.equal(newHandler, handler)
  })

  await t.test('should pick up on the arn', function (t) {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    const spy = sinon.spy(agent, 'recordSupportability')
    t.after(() => {
      spy.restore()
    })
    assert.equal(agent.collector.metadata.arn, null)
    awsLambda.patchLambdaHandler(() => {})(stubEvent, stubContext, stubCallback)
    assert.equal(agent.collector.metadata.arn, stubContext.invokedFunctionArn)
    assert.equal(agent.recordSupportability.callCount, 0)
  })

  await t.test('when invoked with API Gateway Lambda proxy event', async (t) => {
    helper.unloadAgent(t.nr.agent)
    const validResponse = {
      isBase64Encoded: false,
      statusCode: 200,
      headers: { responseHeader: 'headerValue' },
      body: 'worked'
    }

    await t.test(
      'should not create web transaction for custom direct invocation payload',
      (t, end) => {
        const { agent, awsLambda, stubContext, stubCallback } = t.nr
        agent.on('transactionFinished', confirmAgentAttribute)

        const nonApiGatewayProxyEvent = {
          resource: {
            some: 'key'
          },
          action: 'someAction'
        }

        const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
          const transaction = agent.tracer.getTransaction()

          assert.ok(transaction)
          assert.equal(transaction.type, 'bg')
          assert.equal(transaction.getFullName(), expectedBgTransactionName)
          assert.equal(transaction.isActive(), true)

          callback(null, validResponse)
        })

        wrappedHandler(nonApiGatewayProxyEvent, stubContext, stubCallback)

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

    await t.test('should create web transaction', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        const transaction = agent.tracer.getTransaction()

        assert.ok(transaction)
        assert.equal(transaction.type, 'web')
        assert.equal(transaction.getFullName(), expectedWebTransactionName)
        assert.equal(transaction.isActive(), true)

        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        assert.equal(agentAttributes['request.method'], 'GET')
        assert.equal(agentAttributes['request.uri'], '/test/hello')

        assert.equal(spanAttributes['request.method'], 'GET')
        assert.equal(spanAttributes['request.uri'], '/test/hello')

        end()
      }
    })

    await t.test(
      'should set w3c tracecontext on transaction if present on request header',
      (t, end) => {
        const { agent, awsLambda, stubContext, stubCallback } = t.nr
        const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
        const traceparent = `00-${expectedTraceId}-00f067aa0ba902b7-00`

        // transaction finished event passes back transaction,
        // so can't pass `done` in or will look like errored.
        agent.on('transactionFinished', () => {
          end()
        })

        agent.config.distributed_tracing.enabled = true

        const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent
        apiGatewayProxyEvent.headers.traceparent = traceparent

        const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
          const transaction = agent.tracer.getTransaction()

          const headers = {}
          transaction.insertDistributedTraceHeaders(headers)

          const traceParentFields = headers.traceparent.split('-')
          const [version, traceId] = traceParentFields

          assert.equal(version, '00')
          assert.equal(traceId, expectedTraceId)

          callback(null, validResponse)
        })

        wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)
      }
    )

    await t.test(
      'should add w3c tracecontext to transaction if not present on request header',
      (t, end) => {
        const { agent, awsLambda, stubContext, stubCallback } = t.nr
        // transaction finished event passes back transaction,
        // so can't pass `done` in or will look like errored.
        agent.on('transactionFinished', () => {
          end()
        })

        agent.config.account_id = 'AccountId1'
        agent.config.primary_application_id = 'AppId1'
        agent.config.trusted_account_key = 33
        agent.config.distributed_tracing.enabled = true

        const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

        const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
          const transaction = agent.tracer.getTransaction()

          const headers = {}
          transaction.insertDistributedTraceHeaders(headers)

          assert.ok(headers.traceparent)
          assert.ok(headers.tracestate)

          callback(null, validResponse)
        })

        wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)
      }
    )

    await t.test('should capture request parameters', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      agent.config.attributes.enabled = true
      agent.config.attributes.include = ['request.parameters.*']
      agent.config.emit('attributes.include')

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        assert.equal(agentAttributes['request.parameters.name'], 'me')
        assert.equal(agentAttributes['request.parameters.team'], 'node agent')

        end()
      }
    })

    await t.test('should capture request parameters in Span Attributes', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      agent.config.attributes.enabled = true
      agent.config.span_events.attributes.include = ['request.parameters.*']
      agent.config.emit('span_events.attributes.include')

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        assert.equal(spanAttributes['request.parameters.name'], 'me')
        assert.equal(spanAttributes['request.parameters.team'], 'node agent')

        end()
      }
    })

    await t.test('should capture request headers', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        assert.equal(
          agentAttributes['request.headers.accept'],
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        )
        assert.equal(
          agentAttributes['request.headers.acceptEncoding'],
          'gzip, deflate, lzma, sdch, br'
        )
        assert.equal(agentAttributes['request.headers.acceptLanguage'], 'en-US,en;q=0.8')
        assert.equal(agentAttributes['request.headers.cloudFrontForwardedProto'], 'https')
        assert.equal(agentAttributes['request.headers.cloudFrontIsDesktopViewer'], 'true')
        assert.equal(agentAttributes['request.headers.cloudFrontIsMobileViewer'], 'false')
        assert.equal(agentAttributes['request.headers.cloudFrontIsSmartTVViewer'], 'false')
        assert.equal(agentAttributes['request.headers.cloudFrontIsTabletViewer'], 'false')
        assert.equal(agentAttributes['request.headers.cloudFrontViewerCountry'], 'US')
        assert.equal(
          agentAttributes['request.headers.host'],
          'wt6mne2s9k.execute-api.us-west-2.amazonaws.com'
        )
        assert.equal(agentAttributes['request.headers.upgradeInsecureRequests'], '1')
        assert.equal(
          agentAttributes['request.headers.userAgent'],
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6)'
        )
        assert.equal(
          agentAttributes['request.headers.via'],
          '1.1 fb7cca60f0ecd82ce07790c9c5eef16c.cloudfront.net (CloudFront)'
        )

        end()
      }
    })

    await t.test('should filter request headers by `exclude` rules', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        assert.equal('request.headers.X-Amz-Cf-Id' in agentAttributes, false)
        assert.equal('request.headers.X-Forwarded-For' in agentAttributes, false)
        assert.equal('request.headers.X-Forwarded-Port' in agentAttributes, false)
        assert.equal('request.headers.X-Forwarded-Proto' in agentAttributes, false)

        assert.equal('request.headers.xAmzCfId' in agentAttributes, false)
        assert.equal('request.headers.xForwardedFor' in agentAttributes, false)
        assert.equal('request.headers.xForwardedPort' in agentAttributes, false)
        assert.equal('request.headers.xForwardedProto' in agentAttributes, false)

        assert.equal('request.headers.XAmzCfId' in agentAttributes, false)
        assert.equal('request.headers.XForwardedFor' in agentAttributes, false)
        assert.equal('request.headers.XForwardedPort' in agentAttributes, false)
        assert.equal('request.headers.XForwardedProto' in agentAttributes, false)

        end()
      }
    })

    await t.test('should capture status code', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.agent.tracer.getSegment()
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        assert.equal(agentAttributes['http.statusCode'], '200')
        assert.equal(spanAttributes['http.statusCode'], '200')

        end()
      }
    })

    await t.test('should capture response status code in async lambda', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler(() => {
        return Promise.resolve({
          status: 200,
          statusCode: 200,
          statusDescription: 'Success',
          isBase64Encoded: false,
          headers: {}
        })
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        assert.equal(agentAttributes['http.statusCode'], '200')
        assert.equal(spanAttributes['http.statusCode'], '200')

        end()
      }
    })

    await t.test('should capture response headers', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        assert.equal(agentAttributes['response.headers.responseHeader'], 'headerValue')

        end()
      }
    })

    await t.test('should work when responding without headers', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, {
          isBase64Encoded: false,
          statusCode: 200,
          body: 'worked'
        })
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        assert.equal(agentAttributes['http.statusCode'], '200')

        end()
      }
    })

    await t.test('should detect event type', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'apiGateway')

        end()
      }
    })

    await t.test('should collect event source meta data', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.agent.tracer.getSegment()
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        assert.equal(agentAttributes['aws.lambda.eventSource.accountId'], '123456789012')
        assert.equal(agentAttributes['aws.lambda.eventSource.apiId'], 'wt6mne2s9k')
        assert.equal(agentAttributes['aws.lambda.eventSource.resourceId'], 'us4z18')
        assert.equal(agentAttributes['aws.lambda.eventSource.resourcePath'], '/{proxy+}')
        assert.equal(agentAttributes['aws.lambda.eventSource.stage'], 'test')

        assert.equal(spanAttributes['aws.lambda.eventSource.accountId'], '123456789012')
        assert.equal(spanAttributes['aws.lambda.eventSource.apiId'], 'wt6mne2s9k')
        assert.equal(spanAttributes['aws.lambda.eventSource.resourceId'], 'us4z18')
        assert.equal(spanAttributes['aws.lambda.eventSource.resourcePath'], '/{proxy+}')
        assert.equal(spanAttributes['aws.lambda.eventSource.stage'], 'test')

        end()
      }
    })

    await t.test('should record standard web metrics', (t, end) => {
      const { agent, awsLambda, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', confirmMetrics)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmMetrics() {
        const unscopedMetrics = getMetrics(agent).unscoped
        assert.ok(unscopedMetrics)

        assert.ok(unscopedMetrics.HttpDispatcher)
        assert.equal(unscopedMetrics.HttpDispatcher.callCount, 1)

        assert.ok(unscopedMetrics.Apdex)
        assert.equal(unscopedMetrics.Apdex.satisfying, 1)

        const transactionApdex = 'Apdex/' + expectedTransactionName
        assert.ok(unscopedMetrics[transactionApdex])
        assert.equal(unscopedMetrics[transactionApdex].satisfying, 1)

        assert.ok(unscopedMetrics.WebTransaction)
        assert.equal(unscopedMetrics.WebTransaction.callCount, 1)

        assert.ok(unscopedMetrics[expectedWebTransactionName])
        assert.equal(unscopedMetrics[expectedWebTransactionName].callCount, 1)

        assert.ok(unscopedMetrics.WebTransactionTotalTime)
        assert.equal(unscopedMetrics.WebTransactionTotalTime.callCount, 1)

        const transactionWebTotalTime = 'WebTransactionTotalTime/' + expectedTransactionName
        assert.ok(unscopedMetrics[transactionWebTotalTime])
        assert.equal(unscopedMetrics[transactionWebTotalTime].callCount, 1)

        end()
      }
    })
  })

  await t.test('should create a segment for handler', (t, end) => {
    const { awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      const segment = awsLambda.shim.getSegment()
      assert.notEqual(segment, null)
      assert.equal(segment.name, functionName)

      end(callback(null, 'worked'))
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  await t.test('should capture cold start boolean on first invocation', (t, end) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmColdStart)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmColdStart(transaction) {
      const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      assert.equal(attributes['aws.lambda.coldStart'], true)
      end()
    }
  })

  await t.test('should not include cold start on subsequent invocations', (t, end) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    let transactionNum = 1

    agent.on('transactionFinished', confirmNoAdditionalColdStart)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
    wrappedHandler(stubEvent, stubContext, () => {
      end()
    })

    function confirmNoAdditionalColdStart(transaction) {
      if (transactionNum > 1) {
        const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.agent.tracer.getSegment()
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)
        assert.equal('aws.lambda.coldStart' in attributes, false)
        assert.equal('aws.lambda.coldStart' in spanAttributes, false)
      }

      transactionNum++
    }
  })

  await t.test('should capture AWS agent attributes and send to correct dests', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttributes)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    const stubEvt = {
      Records: [{ eventSourceARN: 'stub:eventsource:arn' }]
    }

    wrappedHandler(stubEvt, stubContext, stubCallback)

    function confirmAgentAttributes(transaction) {
      // verify attributes exist in correct destinations
      const txTrace = _verifyDestinations(transaction)

      // now verify actual values
      assert.equal(txTrace[REQ_ID], stubContext.awsRequestId)
      assert.equal(txTrace[LAMBDA_ARN], stubContext.invokedFunctionArn)
      assert.equal(txTrace[COLDSTART], true)
      end()
    }

    function _verifyDestinations(tx) {
      const txTrace = tx.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const errEvent = tx.trace.attributes.get(ATTR_DEST.ERROR_EVENT)
      const txEvent = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      const all = [REQ_ID, LAMBDA_ARN, COLDSTART, EVENTSOURCE_ARN]

      all.forEach((key) => {
        assert.notEqual(txTrace[key], undefined)
        assert.notEqual(errEvent[key], undefined)
        assert.notEqual(txEvent[key], undefined)
      })

      return txTrace
    }
  })

  await t.test('should not add attributes from empty event', (t, end) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(EVENTSOURCE_ARN in agentAttributes, false)
      assert.equal(EVENTSOURCE_TYPE in agentAttributes, false)
      assert.equal(EVENTSOURCE_ARN in spanAttributes, false)
      assert.equal(EVENTSOURCE_TYPE in spanAttributes, false)
      end()
    }
  })

  await t.test('should capture kinesis data stream event source arn', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.kinesisDataStreamEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes[EVENTSOURCE_ARN], 'kinesis:eventsourcearn')
      assert.equal(spanAttributes[EVENTSOURCE_ARN], 'kinesis:eventsourcearn')
      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'kinesis')
      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'kinesis')
      end()
    }
  })

  await t.test('should capture S3 PUT event source arn attribute', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.s3PutEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes[EVENTSOURCE_ARN], 'bucketarn')
      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 's3')

      assert.equal(spanAttributes[EVENTSOURCE_ARN], 'bucketarn')
      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 's3')

      end()
    }
  })

  await t.test('should capture SNS event source arn attribute', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.snsEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes[EVENTSOURCE_ARN], 'eventsubscriptionarn')
      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'sns')

      assert.equal(spanAttributes[EVENTSOURCE_ARN], 'eventsubscriptionarn')
      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'sns')
      end()
    }
  })

  await t.test('should capture DynamoDB Update event source attribute', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.dynamoDbUpdateEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes[EVENTSOURCE_ARN], 'dynamodb:eventsourcearn')
      assert.equal(spanAttributes[EVENTSOURCE_ARN], 'dynamodb:eventsourcearn')
      end()
    }
  })

  await t.test('should capture CodeCommit event source attribute', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.codeCommitEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(
        agentAttributes[EVENTSOURCE_ARN],
        'arn:aws:codecommit:us-west-2:123456789012:my-repo'
      )
      assert.equal(
        spanAttributes[EVENTSOURCE_ARN],
        'arn:aws:codecommit:us-west-2:123456789012:my-repo'
      )
      end()
    }
  })

  await t.test('should not capture unknown event source attribute', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.cloudFrontEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes[EVENTSOURCE_ARN], undefined)
      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'cloudFront')
      assert.equal(spanAttributes[EVENTSOURCE_ARN], undefined)
      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'cloudFront')
      end()
    }
  })

  await t.test('should capture Kinesis Data Firehose event source attribute', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.kinesisDataFirehoseEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes[EVENTSOURCE_ARN], 'aws:lambda:events')
      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'firehose')

      assert.equal(spanAttributes[EVENTSOURCE_ARN], 'aws:lambda:events')
      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'firehose')
      end()
    }
  })

  await t.test('should capture ALB event type', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.albEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(
        agentAttributes[EVENTSOURCE_ARN],
        'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
      )

      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'alb')

      assert.equal(
        spanAttributes[EVENTSOURCE_ARN],
        'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
      )

      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'alb')
      end()
    }
  })

  await t.test('should capture CloudWatch Scheduled event type', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.cloudwatchScheduled

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(
        agentAttributes[EVENTSOURCE_ARN],
        'arn:aws:events:us-west-2:123456789012:rule/ExampleRule'
      )
      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'cloudWatch_scheduled')

      assert.equal(
        spanAttributes[EVENTSOURCE_ARN],
        'arn:aws:events:us-west-2:123456789012:rule/ExampleRule'
      )
      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'cloudWatch_scheduled')
      end()
    }
  })

  await t.test('should capture SES event type', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    const stubEvent = lambdaSampleEvents.sesEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'ses')
      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'ses')
      end()
    }
  })

  await t.test('should capture ALB event type with multi value parameters', (t, end) => {
    const { agent, awsLambda, stubContext, stubCallback } = t.nr
    agent.on('transactionFinished', confirmAgentAttribute)

    agent.config.attributes.enabled = true
    agent.config.attributes.include = ['request.parameters.*']
    agent.config.emit('attributes.include')

    const stubEvent = lambdaSampleEvents.albEventWithMultiValueParameters

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      assert.equal(
        agentAttributes[EVENTSOURCE_ARN],
        'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
      )

      assert.equal(agentAttributes[EVENTSOURCE_TYPE], 'alb')

      assert.equal(agentAttributes['request.method'], 'GET')

      // validate that multi value query string parameters are normalized to comma seperated strings
      assert.equal(agentAttributes['request.parameters.query'], '1234ABCD,other')

      assert.equal(
        spanAttributes[EVENTSOURCE_ARN],
        'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
      )

      assert.equal(spanAttributes[EVENTSOURCE_TYPE], 'alb')

      // validate that multi value headers are normalized to comma seperated strings
      assert.equal(
        spanAttributes['request.headers.setCookie'],
        'cookie-name=cookie-value;Domain=myweb.com;Secure;HttpOnly,cookie-name=cookie-other-value'
      )
      end()
    }
  })

  await t.test('when callback used', async (t) => {
    helper.unloadAgent(t.nr.agent)

    await t.test('should end appropriately', (t, end) => {
      const { agent, awsLambda, stubEvent, stubContext } = t.nr
      let transaction

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        transaction = agent.tracer.getTransaction()
        callback(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, function confirmEndCallback() {
        assert.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        assert.equal(currentTransaction, null)
        end()
      })
    })

    await t.test('should notice errors', (t, end) => {
      const { agent, awsLambda, error, stubEvent, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(error, 'failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        assert.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        assert.equal(noticedError[1], expectedBgTransactionName)
        assert.equal(noticedError[2], errorMessage)
        assert.equal(noticedError[3], 'SyntaxError')

        end()
      }
    })

    await t.test('should notice string errors', (t, end) => {
      const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        // eslint-disable-next-line n/no-callback-literal
        callback('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        assert.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        assert.equal(noticedError[1], expectedBgTransactionName)
        assert.equal(noticedError[2], 'failed')
        assert.equal(noticedError[3], 'Error')

        const data = noticedError[4]
        assert.ok(data.stack_trace)

        end()
      }
    })
  })

  await test('when context.done used', async (t) => {
    helper.unloadAgent(t.nr.agent)

    await t.test('should end appropriately', (t, end) => {
      const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
      let transaction

      stubContext.done = confirmEndCallback

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.done(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmEndCallback() {
        assert.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        assert.equal(currentTransaction, null)
        end()
      }
    })

    await t.test('should notice errors', (t, end) => {
      const { agent, awsLambda, error, stubEvent, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', function confirmErrorCapture() {
        assert.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        assert.equal(noticedError[1], expectedBgTransactionName)
        assert.equal(noticedError[2], errorMessage)
        assert.equal(noticedError[3], 'SyntaxError')

        end()
      })

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.done(error, 'failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
    })

    await t.test('should notice string errors', (t, end) => {
      const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', function confirmErrorCapture() {
        assert.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        assert.equal(noticedError[1], expectedBgTransactionName)
        assert.equal(noticedError[2], 'failed')
        assert.equal(noticedError[3], 'Error')

        const data = noticedError[4]
        assert.ok(data.stack_trace)

        end()
      })

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.done('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
    })
  })

  await t.test('when context.succeed used', async (t) => {
    helper.unloadAgent(t.nr.agent)

    await t.test('should end appropriately', (t, end) => {
      const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
      let transaction

      stubContext.succeed = function confirmEndCallback() {
        assert.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        assert.equal(currentTransaction, null)
        end()
      }

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.succeed('worked')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
    })
  })

  await t.test('when context.fail used', async (t) => {
    helper.unloadAgent(t.nr.agent)

    await t.test('should end appropriately', (t, end) => {
      const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
      let transaction

      stubContext.fail = function confirmEndCallback() {
        assert.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        assert.equal(currentTransaction, null)
        end()
      }

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.fail()
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
    })

    await t.test('should notice errors', (t, end) => {
      const { agent, awsLambda, error, stubEvent, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', function confirmErrorCapture() {
        assert.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        assert.equal(noticedError[1], expectedBgTransactionName)
        assert.equal(noticedError[2], errorMessage)
        assert.equal(noticedError[3], 'SyntaxError')

        end()
      })

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.fail(error)
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
    })

    await t.test('should notice string errors', (t, end) => {
      const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', function confirmErrorCapture() {
        assert.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        assert.equal(noticedError[1], expectedBgTransactionName)
        assert.equal(noticedError[2], 'failed')
        assert.equal(noticedError[3], 'Error')

        const data = noticedError[4]
        assert.ok(data.stack_trace)

        end()
      })

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.fail('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
    })
  })

  await t.test('should create a transaction for handler', (t, end) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      const transaction = agent.tracer.getTransaction()

      assert.ok(transaction)
      assert.equal(transaction.type, 'bg')
      assert.equal(transaction.getFullName(), expectedBgTransactionName)
      assert.ok(transaction.isActive())

      callback(null, 'worked')
      end()
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  await t.test('should end transactions on a beforeExit event on process', async (t) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    const plan = tspl(t, { plan: 6 })
    tempRemoveListeners({ t, emitter: process, event: 'beforeExit' })
    agent.on('harvestStarted', () => {
      plan.ok(1)
    })

    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      const transaction = agent.tracer.getTransaction()

      plan.ok(transaction)
      plan.equal(transaction.type, 'bg')
      plan.equal(transaction.getFullName(), expectedBgTransactionName)
      plan.ok(transaction.isActive())

      process.emit('beforeExit')

      plan.equal(transaction.isActive(), false)
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
    await plan.completed
  })

  await t.test('should end transactions after the returned promise resolves', (t, end) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    let transaction
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      transaction = agent.tracer.getTransaction()
      return new Promise((resolve) => {
        assert.ok(transaction)
        assert.equal(transaction.type, 'bg')
        assert.equal(transaction.getFullName(), expectedBgTransactionName)
        assert.ok(transaction.isActive())

        return resolve('hello')
      })
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
      .then((value) => {
        assert.equal(value, 'hello')
        assert.equal(transaction.isActive(), false)

        end()
      })
      .catch((err) => {
        end(err)
      })
  })

  await t.test('should record error event when func is async and promise is rejected', (t, end) => {
    const { agent, awsLambda, error, stubEvent, stubContext, stubCallback } = t.nr
    agent.on('harvestStarted', confirmErrorCapture)

    let transaction
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      transaction = agent.tracer.getTransaction()
      return new Promise((resolve, reject) => {
        assert.ok(transaction)
        assert.equal(transaction.type, 'bg')
        assert.equal(transaction.getFullName(), expectedBgTransactionName)
        assert.ok(transaction.isActive())

        reject(error)
      })
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
      .then(() => {
        end(Error('wrapped handler should fail and go to catch block'))
      })
      .catch((err) => {
        assert.equal(err, error)
        assert.equal(transaction.isActive(), false)

        end()
      })

    function confirmErrorCapture() {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 1)

      const noticedError = errors[0]
      const [, transactionName, message, type] = noticedError
      assert.equal(transactionName, expectedBgTransactionName)
      assert.equal(message, errorMessage)
      assert.equal(type, 'SyntaxError')
    }
  })

  await t.test('should record error event when func is async and error is thrown', async (t) => {
    const { agent, awsLambda, error, stubEvent, stubContext, stubCallback } = t.nr
    const plan = tspl(t, { plan: 10 })
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
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      transaction = agent.tracer.getTransaction()
      return new Promise(() => {
        plan.ok(transaction)
        plan.equal(transaction.type, 'bg')
        plan.equal(transaction.getFullName(), expectedBgTransactionName)
        plan.ok(transaction.isActive())

        throw error
      })
    })

    try {
      await wrappedHandler(stubEvent, stubContext, stubCallback)
    } catch (err) {
      plan.equal(err, error)
      plan.equal(transaction.isActive(), false)
    }

    await plan.completed
  })

  await t.test(
    'should record error event when func is async an UnhandledPromiseRejection is thrown',
    (t, end) => {
      const { agent, awsLambda, error, stubEvent, stubContext, stubCallback } = t.nr
      agent.on('harvestStarted', function confirmErrorCapture() {
        const errors = agent.errors.traceAggregator.errors
        assert.equal(errors.length, 1)

        const noticedError = errors[0]
        const [, transactionName, message, type] = noticedError
        assert.equal(transactionName, expectedBgTransactionName)
        assert.equal(message, errorMessage)
        assert.equal(type, 'SyntaxError')
      })

      let transaction
      const wrappedHandler = awsLambda.patchLambdaHandler(async () => {
        transaction = agent.tracer.getTransaction()
        // We need this promise to evaluate out-of-band in order to test the
        // correct scenario.
        // eslint-disable-next-line no-new
        new Promise(() => {
          assert.ok(transaction)
          assert.equal(transaction.type, 'bg')
          assert.equal(transaction.getFullName(), expectedBgTransactionName)
          assert.ok(transaction.isActive())

          throw error
        })

        await new Promise((resolve) => setTimeout(resolve, 1))
      })

      tempOverrideUncaught({
        t,
        type: tempOverrideUncaught.REJECTION,
        handler(err) {
          assert.equal(err, error)
          assert.equal(transaction.isActive(), false)
          end()
        }
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
    }
  )

  await t.test('should record error event when error is thrown', async (t) => {
    const plan = tspl(t, { plan: 8 })
    const { agent, awsLambda, error, stubEvent, stubContext, stubCallback } = t.nr

    agent.on('harvestStarted', function confirmErrorCapture() {
      const errors = agent.errors.traceAggregator.errors
      plan.equal(errors.length, 1)

      const noticedError = errors[0]
      const [, transactionName, message, type] = noticedError
      plan.equal(transactionName, expectedBgTransactionName)
      plan.equal(message, errorMessage)
      plan.equal(type, 'SyntaxError')
    })
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      const transaction = agent.tracer.getTransaction()
      plan.ok(transaction)
      plan.equal(transaction.type, 'bg')
      plan.equal(transaction.getFullName(), expectedBgTransactionName)
      plan.ok(transaction.isActive())

      throw error
    })

    try {
      wrappedHandler(stubEvent, stubContext, stubCallback)
    } catch (error) {
      if (error.name !== 'SyntaxError') {
        throw error
      }
    }
    await plan.completed
  })

  await t.test('should not end transactions twice', (t, end) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    let transaction
    const wrappedHandler = awsLambda.patchLambdaHandler((ev, ctx, cb) => {
      transaction = agent.tracer.getTransaction()
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
        assert.ok(transaction)
        assert.equal(transaction.type, 'bg')
        assert.equal(transaction.getFullName(), expectedBgTransactionName)
        assert.ok(transaction.isActive())

        cb()

        assert.equal(transaction.isActive(), false)
        return resolve('hello')
      })
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
      .then((value) => {
        assert.equal(value, 'hello')
        assert.equal(transaction.isActive(), false)

        end()
      })
      .catch((err) => {
        end(err)
      })
  })

  await t.test('should record standard background metrics', (t, end) => {
    const { agent, awsLambda, stubEvent, stubContext, stubCallback } = t.nr
    agent.on('harvestStarted', confirmMetrics)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmMetrics() {
      const unscopedMetrics = getMetrics(agent).unscoped
      assert.ok(unscopedMetrics)

      const otherTransactionAllName = 'OtherTransaction/all'
      const otherTransactionAllMetric = unscopedMetrics[otherTransactionAllName]
      assert.ok(otherTransactionAllMetric)
      assert.equal(otherTransactionAllMetric.callCount, 1)

      const bgTransactionNameMetric = unscopedMetrics[expectedBgTransactionName]
      assert.ok(bgTransactionNameMetric)
      assert.equal(bgTransactionNameMetric.callCount, 1)

      const otherTransactionTotalTimeMetric = unscopedMetrics.OtherTransactionTotalTime
      assert.ok(otherTransactionTotalTimeMetric)
      assert.equal(otherTransactionAllMetric.callCount, 1)

      const otherTotalTimeBgTransactionName = 'OtherTransactionTotalTime/' + expectedTransactionName
      const otherTotalTimeBgTransactionNameMetric = unscopedMetrics[otherTotalTimeBgTransactionName]
      assert.ok(otherTotalTimeBgTransactionNameMetric)
      assert.equal(otherTotalTimeBgTransactionNameMetric.callCount, 1)

      end()
    }
  })
})
