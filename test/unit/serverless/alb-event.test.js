/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')

const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const AwsLambda = require('../../../lib/serverless/aws-lambda')

const { DESTINATIONS: ATTR_DEST } = require('../../../lib/config/attribute-filter')
const { albEvent } = require('./fixtures')

test.beforeEach((ctx) => {
  // This env var suppresses console output we don't need to inspect.
  process.env.NEWRELIC_PIPE_PATH = os.devNull

  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent({
    allow_all_headers: true,
    serverless_mode: {
      enabled: true
    }
  })

  ctx.nr.lambda = new AwsLambda(ctx.nr.agent)
  ctx.nr.lambda._resetModuleState()

  ctx.nr.event = structuredClone(albEvent)
  ctx.nr.functionContext = {
    done() {},
    succeed() {},
    fail() {},
    functionName: 'testFunction',
    functionVersion: 'testVersion',
    invokedFunctionArn: 'arn:test:function',
    memoryLimitInMB: '128',
    awsRequestId: 'testId'
  }
  ctx.nr.responseBody = {
    isBase64Encoded: false,
    statusCode: 200,
    headers: { responseHeader: 'headerValue' },
    body: 'worked'
  }

  ctx.nr.agent.setState('started')
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should pick up the arn', async (t) => {
  const { agent, lambda, event, functionContext } = t.nr
  assert.equal(agent.collector.metadata.arn, null)
  lambda.patchLambdaHandler(() => {})(event, functionContext, () => {})
  assert.equal(agent.collector.metadata.arn, functionContext.invokedFunctionArn)
})

test('should create a web transaction', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent, lambda, event, functionContext, responseBody } = t.nr
  agent.on('transactionFinished', verifyAttributes)

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    const tx = agent.tracer.getTransaction()
    plan.ok(tx)
    plan.equal(tx.type, 'web')
    plan.equal(tx.getFullName(), 'WebTransaction/Function/testFunction')
    plan.equal(tx.isActive(), true)

    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})

  function verifyAttributes(tx) {
    const agentAttributes = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
    const segment = tx.baseSegment
    const spanAttributes = segment.attributes.get(ATTR_DEST.SPAN_EVENT)

    plan.equal(agentAttributes['request.method'], 'POST')
    plan.equal(agentAttributes['request.uri'], '/elbCategory/elbEndpoint')
    plan.equal(spanAttributes['request.method'], 'POST')
    plan.equal(spanAttributes['request.uri'], '/elbCategory/elbEndpoint')
  }
  await plan.completed
})

test('should set w3c tracecontext on transaction if present on request header', async (t) => {
  const plan = tspl(t, { plan: 2 })

  const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
  const traceparent = `00-${expectedTraceId}-00f067aa0ba902b7-00`
  const { agent, lambda, event, functionContext, responseBody } = t.nr
  agent.config.distributed_tracing.enabled = true
  event.headers.traceparent = traceparent

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    const tx = agent.tracer.getTransaction()

    const headers = {}
    tx.insertDistributedTraceHeaders(headers)

    const traceParentFields = headers.traceparent.split('-')
    const [version, traceId] = traceParentFields

    plan.equal(version, '00')
    plan.equal(traceId, expectedTraceId)

    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})
  await plan.completed
})

test('should add w3c tracecontext to transaction if not present on request header', async (t) => {
  const plan = tspl(t, { plan: 2 })

  const { agent, lambda, event, functionContext, responseBody } = t.nr

  agent.config.distributed_tracing.account_id = 'AccountId1'
  agent.config.distributed_tracing.primary_application_id = 'AppId1'
  agent.config.distributed_tracing.trusted_account_key = 33
  agent.config.distributed_tracing.enabled = true

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    const tx = agent.tracer.getTransaction()

    const headers = {}
    tx.insertDistributedTraceHeaders(headers)

    plan.match(headers.traceparent, /00-[a-f0-9]{32}-[a-f0-9]{16}-\d{2}/)
    plan.match(headers.tracestate, /33@nr=.+AccountId1-AppId1.+/)

    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})
  await plan.completed
})

test('should capture request parameters', async (t) => {
  const plan = tspl(t, { plan: 5 })

  const { agent, lambda, event, functionContext, responseBody } = t.nr
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
    plan.equal(agentAttributes['request.parameters.name'], 'me')
    plan.equal(agentAttributes['request.parameters.team'], 'node agent')

    const spanAttributes = tx.baseSegment.attributes.get(ATTR_DEST.SPAN_EVENT)
    plan.equal(spanAttributes['request.parameters.name'], 'me')
    plan.equal(spanAttributes['request.parameters.team'], 'node agent')

    plan.equal(agentAttributes['request.parameters.parameter1'], 'value1,value2')
  }
  await plan.completed
})

test('should capture request headers', async (t) => {
  const plan = tspl(t, { plan: 8 })

  const { agent, lambda, event, functionContext, responseBody } = t.nr
  agent.on('transactionFinished', verifyAttributes)

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    callback(null, responseBody)
  })
  wrappedHandler(event, functionContext, () => {})

  function verifyAttributes(tx) {
    const attrs = tx.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
    plan.equal(attrs['http.statusCode'], 200)
    plan.equal(attrs['request.headers.accept'], 'application/json;v=4')
    plan.equal(attrs['request.headers.contentLength'], '35')
    plan.equal(attrs['request.headers.contentType'], 'application/json')
    plan.equal(attrs['request.headers.host'], 'examplehost.example.com')
    plan.equal(attrs['request.method'], 'POST')
    plan.equal(attrs['request.uri'], '/elbCategory/elbEndpoint')
    plan.equal(attrs['request.headers.header2'], 'value1,value2')
  }
  await plan.completed
})

test('should not crash when headers are non-existent', (t) => {
  const { lambda, event, functionContext, responseBody } = t.nr
  delete event.headers

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    callback(null, responseBody)
  })

  assert.doesNotThrow(() => {
    wrappedHandler(event, functionContext, () => {})
  })
})
