/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const AwsLambda = require('../../../lib/serverless/aws-lambda')
const lambdaSampleEvents = require('./lambda-sample-events')

const ATTR_DEST = require('../../../lib/config/attribute-filter').DESTINATIONS
// attribute key names
const REQ_ID = 'aws.requestId'
const LAMBDA_ARN = 'aws.lambda.arn'
const COLDSTART = 'aws.lambda.coldStart'
const EVENTSOURCE_ARN = 'aws.lambda.eventSource.arn'
const EVENTSOURCE_TYPE = 'aws.lambda.eventSource.eventType'

tap.test('AwsLambda.patchLambdaHandler', (t) => {
  t.autoend()

  const groupName = 'Function'
  const functionName = 'testName'
  const expectedTransactionName = groupName + '/' + functionName
  const expectedBgTransactionName = 'OtherTransaction/' + expectedTransactionName
  const expectedWebTransactionName = 'WebTransaction/' + expectedTransactionName
  const errorMessage = 'sad day'

  let agent
  let awsLambda

  let stubEvent
  let stubContext
  let stubCallback

  let error

  t.beforeEach(() => {
    if (!agent) {
      agent = helper.loadMockedAgent({
        allow_all_headers: true,
        attributes: {
          exclude: ['request.headers.x*', 'response.headers.x*']
        },
        serverless_mode: {
          enabled: true
        }
      })
    }
    awsLambda = new AwsLambda(agent)
    awsLambda._resetModuleState()

    stubEvent = {}
    ;(stubContext = {
      done: () => {},
      succeed: () => {},
      fail: () => {},
      functionName: functionName,
      functionVersion: 'TestVersion',
      invokedFunctionArn: 'arn:test:function',
      memoryLimitInMB: '128',
      awsRequestId: 'testid'
    }),
      (stubCallback = () => {})

    process.env.AWS_EXECUTION_ENV = 'Test_nodejsNegative2.3'

    error = new SyntaxError(errorMessage)

    agent.setState('started')
  })

  t.afterEach(() => {
    stubEvent = null
    stubContext = null
    stubCallback = null
    error = null

    delete process.env.AWS_EXECUTION_ENV

    if (agent) {
      helper.unloadAgent(agent)
    }

    if (process.emit && process.emit.__NR_unwrap) {
      process.emit.__NR_unwrap()
    }

    agent = null
    awsLambda = null
  })

  t.test('should return original handler if not a function', (t) => {
    const handler = {}
    const newHandler = awsLambda.patchLambdaHandler(handler)

    t.equal(newHandler, handler)
    t.end()
  })

  t.test('should pick up on the arn', function (t) {
    t.equal(agent.collector.metadata.arn, null)
    awsLambda.patchLambdaHandler(() => {})(stubEvent, stubContext, stubCallback)
    t.equal(agent.collector.metadata.arn, stubContext.invokedFunctionArn)
    t.end()
  })

  t.test('when invoked with API Gateway Lambda proxy event', (t) => {
    t.autoend()

    const validResponse = {
      isBase64Encoded: false,
      statusCode: 200,
      headers: { responseHeader: 'headerValue' },
      body: 'worked'
    }

    t.test('should create web transaction', async (t) => {
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        const transaction = agent.tracer.getTransaction()

        t.ok(transaction)
        t.equal(transaction.type, 'web')
        t.equal(transaction.getFullName(), expectedWebTransactionName)
        t.equal(transaction.isActive(), true)

        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        t.equal(agentAttributes['request.method'], 'GET')
        t.equal(agentAttributes['request.uri'], '/test/hello')

        t.equal(spanAttributes['request.method'], 'GET')
        t.equal(spanAttributes['request.uri'], '/test/hello')

        t.end()
      }
    })

    t.test('should set w3c tracecontext on transaction if present on request header', (t) => {
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `00-${expectedTraceId}-00f067aa0ba902b7-00`

      // transaction finished event passes back transaction,
      // so can't pass `done` in or will look like errored.
      agent.on('transactionFinished', () => {
        t.end()
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

        t.equal(version, '00')
        t.equal(traceId, expectedTraceId)

        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)
    })

    t.test('should add w3c tracecontext to transaction if not present on request header', (t) => {
      // transaction finished event passes back transaction,
      // so can't pass `done` in or will look like errored.
      agent.on('transactionFinished', () => {
        t.end()
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

        t.ok(headers.traceparent)
        t.ok(headers.tracestate)

        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)
    })

    t.test('should capture request parameters', (t) => {
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

        t.equal(agentAttributes['request.parameters.name'], 'me')
        t.equal(agentAttributes['request.parameters.team'], 'node agent')

        t.end()
      }
    })

    t.test('should capture request parameters in Span Attributes', (t) => {
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

        t.equal(spanAttributes['request.parameters.name'], 'me')
        t.equal(spanAttributes['request.parameters.team'], 'node agent')

        t.end()
      }
    })

    t.test('should capture request headers', (t) => {
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        t.equal(
          agentAttributes['request.headers.accept'],
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        )
        t.equal(agentAttributes['request.headers.acceptEncoding'], 'gzip, deflate, lzma, sdch, br')
        t.equal(agentAttributes['request.headers.acceptLanguage'], 'en-US,en;q=0.8')
        t.equal(agentAttributes['request.headers.cloudFrontForwardedProto'], 'https')
        t.equal(agentAttributes['request.headers.cloudFrontIsDesktopViewer'], 'true')
        t.equal(agentAttributes['request.headers.cloudFrontIsMobileViewer'], 'false')
        t.equal(agentAttributes['request.headers.cloudFrontIsSmartTVViewer'], 'false')
        t.equal(agentAttributes['request.headers.cloudFrontIsTabletViewer'], 'false')
        t.equal(agentAttributes['request.headers.cloudFrontViewerCountry'], 'US')
        t.equal(
          agentAttributes['request.headers.host'],
          'wt6mne2s9k.execute-api.us-west-2.amazonaws.com'
        )
        t.equal(agentAttributes['request.headers.upgradeInsecureRequests'], '1')
        t.equal(
          agentAttributes['request.headers.userAgent'],
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6)'
        )
        t.equal(
          agentAttributes['request.headers.via'],
          '1.1 fb7cca60f0ecd82ce07790c9c5eef16c.cloudfront.net (CloudFront)'
        )

        t.end()
      }
    })

    t.test('should filter request headers by `exclude` rules', (t) => {
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        t.notOk('request.headers.X-Amz-Cf-Id' in agentAttributes)
        t.notOk('request.headers.X-Forwarded-For' in agentAttributes)
        t.notOk('request.headers.X-Forwarded-Port' in agentAttributes)
        t.notOk('request.headers.X-Forwarded-Proto' in agentAttributes)

        t.notOk('request.headers.xAmzCfId' in agentAttributes)
        t.notOk('request.headers.xForwardedFor' in agentAttributes)
        t.notOk('request.headers.xForwardedPort' in agentAttributes)
        t.notOk('request.headers.xForwardedProto' in agentAttributes)

        t.notOk('request.headers.XAmzCfId' in agentAttributes)
        t.notOk('request.headers.XForwardedFor' in agentAttributes)
        t.notOk('request.headers.XForwardedPort' in agentAttributes)
        t.notOk('request.headers.XForwardedProto' in agentAttributes)

        t.end()
      }
    })

    t.test('should capture status code', (t) => {
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

        t.equal(agentAttributes['http.statusCode'], '200')

        t.equal(spanAttributes['http.statusCode'], '200')

        t.end()
      }
    })

    t.test('should capture response status code in async lambda', (t) => {
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler(() => {
        return new Promise((resolve) => {
          resolve({
            status: 200,
            statusCode: 200,
            statusDescription: 'Success',
            isBase64Encoded: false,
            headers: {}
          })
        })
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

        t.equal(agentAttributes['http.statusCode'], '200')

        t.equal(spanAttributes['http.statusCode'], '200')

        t.end()
      }
    })

    t.test('should capture response headers', (t) => {
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        t.equal(agentAttributes['response.headers.responseHeader'], 'headerValue')

        t.end()
      }
    })

    t.test('should detect event type', (t) => {
      agent.on('transactionFinished', confirmAgentAttribute)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        t.equal(agentAttributes[EVENTSOURCE_TYPE], 'apiGateway')

        t.end()
      }
    })

    t.test('should collect event source meta data', (t) => {
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

        t.equal(agentAttributes['aws.lambda.eventSource.accountId'], '123456789012')
        t.equal(agentAttributes['aws.lambda.eventSource.apiId'], 'wt6mne2s9k')
        t.equal(agentAttributes['aws.lambda.eventSource.resourceId'], 'us4z18')
        t.equal(agentAttributes['aws.lambda.eventSource.resourcePath'], '/{proxy+}')
        t.equal(agentAttributes['aws.lambda.eventSource.stage'], 'test')

        t.equal(spanAttributes['aws.lambda.eventSource.accountId'], '123456789012')
        t.equal(spanAttributes['aws.lambda.eventSource.apiId'], 'wt6mne2s9k')
        t.equal(spanAttributes['aws.lambda.eventSource.resourceId'], 'us4z18')
        t.equal(spanAttributes['aws.lambda.eventSource.resourcePath'], '/{proxy+}')
        t.equal(spanAttributes['aws.lambda.eventSource.stage'], 'test')

        t.end()
      }
    })

    t.test('should record standard web metrics', (t) => {
      agent.on('harvestStarted', confirmMetrics)

      const apiGatewayProxyEvent = lambdaSampleEvents.apiGatewayProxyEvent

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(null, validResponse)
      })

      wrappedHandler(apiGatewayProxyEvent, stubContext, stubCallback)

      function confirmMetrics() {
        const unscopedMetrics = getMetrics(agent).unscoped
        t.ok(unscopedMetrics)

        t.ok(unscopedMetrics.HttpDispatcher)
        t.equal(unscopedMetrics.HttpDispatcher.callCount, 1)

        t.ok(unscopedMetrics.Apdex)
        t.equal(unscopedMetrics.Apdex.satisfying, 1)

        const transactionApdex = 'Apdex/' + expectedTransactionName
        t.ok(unscopedMetrics[transactionApdex])
        t.equal(unscopedMetrics[transactionApdex].satisfying, 1)

        t.ok(unscopedMetrics.WebTransaction)
        t.equal(unscopedMetrics.WebTransaction.callCount, 1)

        t.ok(unscopedMetrics[expectedWebTransactionName])
        t.equal(unscopedMetrics[expectedWebTransactionName].callCount, 1)

        t.ok(unscopedMetrics.WebTransactionTotalTime)
        t.equal(unscopedMetrics.WebTransactionTotalTime.callCount, 1)

        const transactionWebTotalTime = 'WebTransactionTotalTime/' + expectedTransactionName
        t.ok(unscopedMetrics[transactionWebTotalTime])
        t.equal(unscopedMetrics[transactionWebTotalTime].callCount, 1)

        t.end()
      }
    })
  })

  t.test('should create a segment for handler', (t) => {
    t.autoend()

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      const segment = awsLambda.shim.getSegment()
      t.not(segment, null)
      t.equal(segment.name, functionName)

      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  t.test('should capture cold start boolean on first invocation', (t) => {
    agent.on('transactionFinished', confirmColdStart)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmColdStart(transaction) {
      const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      t.equal(attributes['aws.lambda.coldStart'], true)
      t.end()
    }
  })

  t.test('should not include cold start on subsequent invocations', (t) => {
    let transactionNum = 1

    agent.on('transactionFinished', confirmNoAdditionalColdStart)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
    wrappedHandler(stubEvent, stubContext, () => {
      t.end()
    })

    function confirmNoAdditionalColdStart(transaction) {
      if (transactionNum > 1) {
        const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        const segment = transaction.agent.tracer.getSegment()
        const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)
        t.notOk('aws.lambda.coldStart' in attributes)
        t.notOk('aws.lambda.coldStart' in spanAttributes)
      }

      transactionNum++
    }
  })

  t.test('should capture AWS agent attributes and send to correct dests', (t) => {
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
      t.equal(txTrace[REQ_ID], stubContext.awsRequestId)
      t.equal(txTrace[LAMBDA_ARN], stubContext.invokedFunctionArn)
      t.equal(txTrace[COLDSTART], true)

      t.end()
    }

    function _verifyDestinations(tx) {
      const txTrace = tx.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const errEvent = tx.trace.attributes.get(ATTR_DEST.ERROR_EVENT)
      const txEvent = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      const all = [REQ_ID, LAMBDA_ARN, COLDSTART, EVENTSOURCE_ARN]

      all.forEach((key) => {
        t.not(txTrace[key], undefined)
        t.not(errEvent[key], undefined)
        t.not(txEvent[key], undefined)
      })

      return txTrace
    }
  })

  t.test('should not add attributes from empty event', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.notOk(EVENTSOURCE_ARN in agentAttributes)
      t.notOk(EVENTSOURCE_TYPE in agentAttributes)
      t.notOk(EVENTSOURCE_ARN in spanAttributes)
      t.notOk(EVENTSOURCE_TYPE in spanAttributes)
      t.end()
    }
  })

  t.test('should capture kinesis data stream event source arn', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.kinesisDataStreamEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_ARN], 'kinesis:eventsourcearn')
      t.equal(spanAttributes[EVENTSOURCE_ARN], 'kinesis:eventsourcearn')
      t.equal(agentAttributes[EVENTSOURCE_TYPE], 'kinesis')
      t.equal(spanAttributes[EVENTSOURCE_TYPE], 'kinesis')
      t.end()
    }
  })

  t.test('should capture S3 PUT event source arn attribute', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.s3PutEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_ARN], 'bucketarn')
      t.equal(agentAttributes[EVENTSOURCE_TYPE], 's3')

      t.equal(spanAttributes[EVENTSOURCE_ARN], 'bucketarn')
      t.equal(spanAttributes[EVENTSOURCE_TYPE], 's3')

      t.end()
    }
  })

  t.test('should capture SNS event source arn attribute', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.snsEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_ARN], 'eventsubscriptionarn')
      t.equal(agentAttributes[EVENTSOURCE_TYPE], 'sns')

      t.equal(spanAttributes[EVENTSOURCE_ARN], 'eventsubscriptionarn')
      t.equal(spanAttributes[EVENTSOURCE_TYPE], 'sns')
      t.end()
    }
  })

  t.test('should capture DynamoDB Update event source attribute', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.dynamoDbUpdateEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_ARN], 'dynamodb:eventsourcearn')
      t.equal(spanAttributes[EVENTSOURCE_ARN], 'dynamodb:eventsourcearn')
      t.end()
    }
  })

  t.test('should capture CodeCommit event source attribute', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.codeCommitEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_ARN], 'arn:aws:codecommit:us-west-2:123456789012:my-repo')
      t.equal(spanAttributes[EVENTSOURCE_ARN], 'arn:aws:codecommit:us-west-2:123456789012:my-repo')
      t.end()
    }
  })

  t.test('should not capture unknown event source attribute', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.cloudFrontEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_ARN], undefined)
      t.equal(agentAttributes[EVENTSOURCE_TYPE], 'cloudFront')
      t.equal(spanAttributes[EVENTSOURCE_ARN], undefined)
      t.equal(spanAttributes[EVENTSOURCE_TYPE], 'cloudFront')
      t.end()
    }
  })

  t.test('should capture Kinesis Data Firehose event source attribute', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.kinesisDataFirehoseEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_ARN], 'aws:lambda:events')
      t.equal(agentAttributes[EVENTSOURCE_TYPE], 'firehose')

      t.equal(spanAttributes[EVENTSOURCE_ARN], 'aws:lambda:events')
      t.equal(spanAttributes[EVENTSOURCE_TYPE], 'firehose')
      t.end()
    }
  })

  t.test('should capture ALB event type', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.albEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(
        agentAttributes[EVENTSOURCE_ARN],
        'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
      ) // eslint-disable-line max-len

      t.equal(agentAttributes[EVENTSOURCE_TYPE], 'alb')

      t.equal(
        spanAttributes[EVENTSOURCE_ARN],
        'arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a'
      ) // eslint-disable-line max-len

      t.equal(spanAttributes[EVENTSOURCE_TYPE], 'alb')
      t.end()
    }
  })

  t.test('should capture CloudWatch Scheduled event type', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.cloudwatchScheduled

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(
        agentAttributes[EVENTSOURCE_ARN],
        'arn:aws:events:us-west-2:123456789012:rule/ExampleRule'
      )
      t.equal(agentAttributes[EVENTSOURCE_TYPE], 'cloudWatch_scheduled')

      t.equal(
        spanAttributes[EVENTSOURCE_ARN],
        'arn:aws:events:us-west-2:123456789012:rule/ExampleRule'
      )
      t.equal(spanAttributes[EVENTSOURCE_TYPE], 'cloudWatch_scheduled')
      t.end()
    }
  })

  t.test('should capture SES event type', (t) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.sesEvent

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_TRACE)
      const segment = transaction.agent.tracer.getSegment()
      const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

      t.equal(agentAttributes[EVENTSOURCE_TYPE], 'ses')
      t.equal(spanAttributes[EVENTSOURCE_TYPE], 'ses')
      t.end()
    }
  })

  t.test('when callback used', (t) => {
    t.autoend()

    t.test('should end appropriately', (t) => {
      let transaction

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        transaction = agent.tracer.getTransaction()
        callback(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, function confirmEndCallback() {
        t.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        t.equal(currentTransaction, null)
        t.end()
      })
    })

    t.test('should notice errors', (t) => {
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback(error, 'failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        t.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        t.equal(noticedError[1], expectedBgTransactionName)
        t.equal(noticedError[2], errorMessage)
        t.equal(noticedError[3], 'SyntaxError')

        t.end()
      }
    })

    t.test('should notice string errors', (t) => {
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
        callback('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        t.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        t.equal(noticedError[1], expectedBgTransactionName)
        t.equal(noticedError[2], 'failed')
        t.equal(noticedError[3], 'Error')

        const data = noticedError[4]
        t.ok(data.stack_trace)

        t.end()
      }
    })
  })

  t.test('when context.done used', (t) => {
    t.autoend()

    t.test('should end appropriately', (t) => {
      let transaction

      stubContext.done = confirmEndCallback

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.done(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmEndCallback() {
        t.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        t.equal(currentTransaction, null)
        t.end()
      }
    })

    t.test('should notice errors', (t) => {
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.done(error, 'failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        t.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        t.equal(noticedError[1], expectedBgTransactionName)
        t.equal(noticedError[2], errorMessage)
        t.equal(noticedError[3], 'SyntaxError')

        t.end()
      }
    })

    t.test('should notice string errors', (t) => {
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.done('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        t.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        t.equal(noticedError[1], expectedBgTransactionName)
        t.equal(noticedError[2], 'failed')
        t.equal(noticedError[3], 'Error')

        const data = noticedError[4]
        t.ok(data.stack_trace)

        t.end()
      }
    })
  })

  t.test('when context.succeed used', (t) => {
    t.autoend()

    t.test('should end appropriately', (t) => {
      let transaction

      stubContext.succeed = confirmEndCallback

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.succeed('worked')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmEndCallback() {
        t.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        t.equal(currentTransaction, null)
        t.end()
      }
    })
  })

  t.test('when context.fail used', (t) => {
    t.autoend()

    t.test('should end appropriately', (t) => {
      let transaction

      stubContext.fail = confirmEndCallback

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.fail()
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmEndCallback() {
        t.equal(transaction.isActive(), false)

        const currentTransaction = agent.tracer.getTransaction()
        t.equal(currentTransaction, null)
        t.end()
      }
    })

    t.test('should notice errors', (t) => {
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.fail(error)
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        t.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        t.equal(noticedError[1], expectedBgTransactionName)
        t.equal(noticedError[2], errorMessage)
        t.equal(noticedError[3], 'SyntaxError')

        t.end()
      }
    })

    t.test('should notice string errors', (t) => {
      agent.on('harvestStarted', confirmErrorCapture)

      const wrappedHandler = awsLambda.patchLambdaHandler((event, context) => {
        context.fail('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        t.equal(agent.errors.traceAggregator.errors.length, 1)
        const noticedError = agent.errors.traceAggregator.errors[0]
        t.equal(noticedError[1], expectedBgTransactionName)
        t.equal(noticedError[2], 'failed')
        t.equal(noticedError[3], 'Error')

        const data = noticedError[4]
        t.ok(data.stack_trace)

        t.end()
      }
    })
  })

  t.test('should create a transaction for handler', (t) => {
    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      const transaction = agent.tracer.getTransaction()

      t.ok(transaction)
      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), expectedBgTransactionName)
      t.ok(transaction.isActive())

      callback(null, 'worked')
      t.end()
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  t.test('should end transactions on a beforeExit event on process', (t) => {
    helper.temporarilyRemoveListeners(t, process, 'beforeExit')

    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      const transaction = agent.tracer.getTransaction()

      t.ok(transaction)
      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), expectedBgTransactionName)
      t.ok(transaction.isActive())

      process.emit('beforeExit')

      t.equal(transaction.isActive(), false)
      t.end()
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  t.test('should end transactions after the returned promise resolves', (t) => {
    let transaction
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      transaction = agent.tracer.getTransaction()
      return new Promise((resolve) => {
        t.ok(transaction)
        t.equal(transaction.type, 'bg')
        t.equal(transaction.getFullName(), expectedBgTransactionName)
        t.ok(transaction.isActive())

        return resolve('hello')
      })
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
      .then((value) => {
        t.equal(value, 'hello')
        t.equal(transaction.isActive(), false)

        t.end()
      })
      .catch((err) => {
        t.error(err)
        t.end()
      })
  })

  t.test('should record error event when func is async and promise is rejected', (t) => {
    agent.on('harvestStarted', confirmErrorCapture)

    let transaction
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      transaction = agent.tracer.getTransaction()
      return new Promise((resolve, reject) => {
        t.ok(transaction)
        t.equal(transaction.type, 'bg')
        t.equal(transaction.getFullName(), expectedBgTransactionName)
        t.ok(transaction.isActive())

        reject(error)
      })
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
      .then(() => {
        t.error(new Error('wrapped handler should fail and go to catch block'))
        t.end()
      })
      .catch((err) => {
        t.equal(err, error)
        t.equal(transaction.isActive(), false)

        t.end()
      })

    function confirmErrorCapture() {
      const errors = agent.errors.traceAggregator.errors
      t.equal(errors.length, 1)

      const noticedError = errors[0]
      const [, transactionName, message, type] = noticedError
      t.equal(transactionName, expectedBgTransactionName)
      t.equal(message, errorMessage)
      t.equal(type, 'SyntaxError')
    }
  })

  t.test('should record error event when func is async and error is thrown', (t) => {
    agent.on('harvestStarted', confirmErrorCapture)

    let transaction
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      transaction = agent.tracer.getTransaction()
      return new Promise(() => {
        t.ok(transaction)
        t.equal(transaction.type, 'bg')
        t.equal(transaction.getFullName(), expectedBgTransactionName)
        t.ok(transaction.isActive())

        throw error
      })
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
      .then(() => {
        t.error(new Error('wrapped handler should fail and go to catch block'))
        t.end()
      })
      .catch((err) => {
        t.equal(err, error)
        t.equal(transaction.isActive(), false)

        t.end()
      })

    function confirmErrorCapture() {
      const errors = agent.errors.traceAggregator.errors
      t.equal(errors.length, 1)

      const noticedError = errors[0]
      const [, transactionName, message, type] = noticedError
      t.equal(transactionName, expectedBgTransactionName)
      t.equal(message, errorMessage)
      t.equal(type, 'SyntaxError')
    }
  })

  t.test(
    'should record error event when func is async an UnhandledPromiseRejection is thrown',
    (t) => {
      agent.on('harvestStarted', confirmErrorCapture)

      let transaction
      const wrappedHandler = awsLambda.patchLambdaHandler(async () => {
        transaction = agent.tracer.getTransaction()
        // eslint-disable-next-line no-new
        new Promise(() => {
          t.ok(transaction)
          t.equal(transaction.type, 'bg')
          t.equal(transaction.getFullName(), expectedBgTransactionName)
          t.ok(transaction.isActive())

          throw error
        })

        await new Promise((resolve) => setTimeout(resolve, 1))
      })

      process.on('unhandledRejection', (err) => {
        t.equal(err, error)
        t.equal(transaction.isActive(), false)

        t.end()
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)
      function confirmErrorCapture() {
        const errors = agent.errors.traceAggregator.errors
        t.equal(errors.length, 1)

        const noticedError = errors[0]
        const [, transactionName, message, type] = noticedError
        t.equal(transactionName, expectedBgTransactionName)
        t.equal(message, errorMessage)
        t.equal(type, 'SyntaxError')
      }
    }
  )

  t.test('should record error event when error is thrown', (t) => {
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    agent.on('harvestStarted', confirmErrorCapture)
    const wrappedHandler = awsLambda.patchLambdaHandler(() => {
      const transaction = agent.tracer.getTransaction()
      t.ok(transaction)
      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), expectedBgTransactionName)
      t.ok(transaction.isActive())

      throw error
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmErrorCapture() {
      const errors = agent.errors.traceAggregator.errors
      t.equal(errors.length, 1)

      const noticedError = errors[0]
      const [, transactionName, message, type] = noticedError
      t.equal(transactionName, expectedBgTransactionName)
      t.equal(message, errorMessage)
      t.equal(type, 'SyntaxError')

      t.end()
    }
  })

  t.test('should not end transactions twice', (t) => {
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
        t.ok(transaction)
        t.equal(transaction.type, 'bg')
        t.equal(transaction.getFullName(), expectedBgTransactionName)
        t.ok(transaction.isActive())

        cb()

        t.equal(transaction.isActive(), false)
        return resolve('hello')
      })
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
      .then((value) => {
        t.equal(value, 'hello')
        t.equal(transaction.isActive(), false)

        t.end()
      })
      .catch((err) => {
        t.error(err)
        t.end()
      })
  })

  t.test('should record standard background metrics', (t) => {
    agent.on('harvestStarted', confirmMetrics)

    const wrappedHandler = awsLambda.patchLambdaHandler((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmMetrics() {
      const unscopedMetrics = getMetrics(agent).unscoped
      t.ok(unscopedMetrics)

      const otherTransactionAllName = 'OtherTransaction/all'
      const otherTransactionAllMetric = unscopedMetrics[otherTransactionAllName]
      t.ok(otherTransactionAllMetric)
      t.equal(otherTransactionAllMetric.callCount, 1)

      const bgTransactionNameMetric = unscopedMetrics[expectedBgTransactionName]
      t.ok(bgTransactionNameMetric)
      t.equal(bgTransactionNameMetric.callCount, 1)

      const otherTransactionTotalTimeMetric = unscopedMetrics.OtherTransactionTotalTime
      t.ok(otherTransactionTotalTimeMetric)
      t.equal(otherTransactionAllMetric.callCount, 1)

      const otherTotalTimeBgTransactionName = 'OtherTransactionTotalTime/' + expectedTransactionName
      const otherTotalTimeBgTransactionNameMetric = unscopedMetrics[otherTotalTimeBgTransactionName]
      t.ok(otherTotalTimeBgTransactionNameMetric)
      t.equal(otherTotalTimeBgTransactionNameMetric.callCount, 1)

      t.end()
    }
  })
})

function getMetrics(agent) {
  return agent.metrics._metrics
}
