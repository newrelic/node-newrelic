/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const os = require('os')
const rfdc = require('rfdc')()
const helper = require('../../lib/agent_helper')
const AwsLambda = require('../../../lib/serverless/aws-lambda')

const ATTR_DEST = require('../../../lib/config/attribute-filter').DESTINATIONS

// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
const v2Event = {
  version: '2.0',
  routeKey: '$default',
  rawPath: '/my/path',
  rawQueryString: 'parameter1=value1&parameter1=value2&parameter2=value',
  cookies: ['cookie1', 'cookie2'],
  headers: {
    header1: 'value1',
    header2: 'value1,value2',
    accept: 'application/json'
  },
  queryStringParameters: {
    parameter1: 'value1,value2',
    parameter2: 'value',
    name: 'me',
    team: 'node agent'
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    authentication: {
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT'
        }
      }
    },
    authorizer: {
      jwt: {
        claims: {
          claim1: 'value1',
          claim2: 'value2'
        },
        scopes: ['scope1', 'scope2']
      }
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    http: {
      method: 'POST',
      path: '/my/path',
      protocol: 'HTTP/1.1',
      sourceIp: '192.0.2.1',
      userAgent: 'agent'
    },
    requestId: 'id',
    routeKey: '$default',
    stage: '$default',
    time: '12/Mar/2020:19:03:58 +0000',
    timeEpoch: 1583348638390
  },
  body: 'Hello from Lambda',
  pathParameters: {
    parameter1: 'value1'
  },
  isBase64Encoded: false,
  stageVariables: {
    stageVariable1: 'value1',
    stageVariable2: 'value2'
  }
}

tap.beforeEach((t) => {
  // This env var suppresses console output we don't need to inspect.
  process.env.NEWRELIC_PIPE_PATH = os.devNull

  t.context.agent = helper.loadMockedAgent({
    allow_all_headers: true,
    serverless_mode: {
      enabled: true
    }
  })

  t.context.lambda = new AwsLambda(t.context.agent)
  t.context.lambda._resetModuleState()

  // structuredClone is not available in Node 16 ☹️
  t.context.event = rfdc(v2Event)
  t.context.functionContext = {
    done() {},
    succeed() {},
    fail() {},
    functionName: 'testFunction',
    functionVersion: 'testVersion',
    invokedFunctionArn: 'arn:test:function',
    memoryLimitInMB: '128',
    awsRequestId: 'testId'
  }
  t.context.responseBody = {
    isBase64Encoded: false,
    statusCode: 200,
    headers: { responseHeader: 'headerValue' },
    body: 'worked'
  }

  t.context.agent.setState('started')
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
})

tap.test('should pick up the arn', async (t) => {
  const { agent, lambda, event, functionContext } = t.context
  t.equal(agent.collector.metadata.arn, null)
  lambda.patchLambdaHandler(() => {})(event, functionContext, () => {})
  t.equal(agent.collector.metadata.arn, functionContext.invokedFunctionArn)
})

tap.test('should create a web transaction', (t) => {
  t.plan(8)

  const { agent, lambda, event, functionContext, responseBody } = t.context
  agent.on('transactionFinished', verifyAttributes)

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    const tx = agent.tracer.getTransaction()
    t.ok(tx)
    t.equal(tx.type, 'web')
    t.equal(tx.getFullName(), 'WebTransaction/Function/testFunction')
    t.equal(tx.isActive(), true)

    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})

  function verifyAttributes(tx) {
    const agentAttributes = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
    const segment = tx.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    t.equal(agentAttributes['request.method'], 'POST')
    t.equal(agentAttributes['request.uri'], '/my/path')
    t.equal(spanAttributes['request.method'], 'POST')
    t.equal(spanAttributes['request.uri'], '/my/path')

    t.end()
  }
})

tap.test('should set w3c tracecontext on transaction if present on request header', (t) => {
  t.plan(2)

  const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
  const traceparent = `00-${expectedTraceId}-00f067aa0ba902b7-00`
  const { agent, lambda, event, functionContext, responseBody } = t.context
  agent.on('transactionFinished', () => {
    t.end()
  })

  agent.config.distributed_tracing.enabled = true
  event.headers.traceparent = traceparent

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    const tx = agent.tracer.getTransaction()

    const headers = {}
    tx.insertDistributedTraceHeaders(headers)

    const traceParentFields = headers.traceparent.split('-')
    const [version, traceId] = traceParentFields

    t.equal(version, '00')
    t.equal(traceId, expectedTraceId)

    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})
})

tap.test('should add w3c tracecontext to transaction if not present on request header', (t) => {
  t.plan(2)

  const { agent, lambda, event, functionContext, responseBody } = t.context
  agent.on('transactionFinished', () => {
    t.end()
  })

  agent.config.account_id = 'AccountId1'
  agent.config.primary_application_id = 'AppId1'
  agent.config.trusted_account_key = 33
  agent.config.distributed_tracing.enabled = true

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    const tx = agent.tracer.getTransaction()

    const headers = {}
    tx.insertDistributedTraceHeaders(headers)

    t.match(headers.traceparent, /00-[a-f0-9]{32}-[a-f0-9]{16}-\d{2}/)
    t.match(headers.tracestate, /33@nr=.+AccountId1-AppId1.+/)

    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})
})

tap.test('should capture request parameters', (t) => {
  t.plan(5)

  const { agent, lambda, event, functionContext, responseBody } = t.context
  agent.on('transactionFinished', verifyAttributes)

  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.span_events.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')
  agent.config.emit('span_events.attributes.include')

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})

  function verifyAttributes(tx) {
    const agentAttributes = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
    t.equal(agentAttributes['request.parameters.name'], 'me')
    t.equal(agentAttributes['request.parameters.team'], 'node agent')

    const spanAttributes = tx.baseSegment.attributes.get(ATTR_DEST.SPAN_EVENT)
    t.equal(spanAttributes['request.parameters.name'], 'me')
    t.equal(spanAttributes['request.parameters.team'], 'node agent')

    t.equal(agentAttributes['request.parameters.parameter1'], 'value1,value2')

    t.end()
  }
})

tap.test('should capture request headers', (t) => {
  t.plan(2)

  const { agent, lambda, event, functionContext, responseBody } = t.context
  agent.on('transactionFinished', verifyAttributes)

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    callback(null, responseBody)
  })
  wrappedHandler(event, functionContext, () => {})

  function verifyAttributes(tx) {
    const attrs = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

    t.equal(attrs['request.headers.accept'], 'application/json')
    t.equal(attrs['request.headers.header2'], 'value1,value2')

    t.end()
  }
})
