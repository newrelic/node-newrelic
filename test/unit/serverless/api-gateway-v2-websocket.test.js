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

const { lambdaAuthorizerEvent } = require('./fixtures')

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

  ctx.nr.event = structuredClone(lambdaAuthorizerEvent)
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

test('should not create a web transaction', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, lambda, event, functionContext, responseBody } = t.nr

  const wrappedHandler = lambda.patchLambdaHandler((event, context, callback) => {
    const tx = agent.tracer.getTransaction()
    plan.ok(tx)
    plan.equal(tx.type, 'bg')
    plan.equal(tx.getFullName(), 'OtherTransaction/Function/testFunction')
    plan.equal(tx.isActive(), true)

    callback(null, responseBody)
  })

  wrappedHandler(event, functionContext, () => {})

  await plan.completed
})

test('should add w3c tracecontext to transaction if not present on request header', async (t) => {
  const plan = tspl(t, { plan: 2 })

  const { agent, lambda, event, functionContext, responseBody } = t.nr

  agent.config.distributed_tracing.account_id = 'AccountId1'
  agent.config.primary_application_id = 'AppId1'
  agent.config.trusted_account_key = 33
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
