/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const {
  isGatewayV1ProxyEvent,
  isGatewayV2ProxyEvent
} = require('../../../lib/serverless/api-gateway')

const {
  restApiGatewayV1Event,
  httpApiGatewayV1Event,
  httpApiGatewayV2Event,
  httpApiGatewayV2EventAlt,
  lambdaV1InvocationEvent,
  albEvent,
  lambdaEvent,
  lambdaAuthorizerEvent
} = require('./fixtures')

test('isGatewayV1ProxyEvent', () => {
  assert.equal(isGatewayV1ProxyEvent(restApiGatewayV1Event), true)
  assert.equal(isGatewayV1ProxyEvent(httpApiGatewayV1Event), true)
  assert.equal(isGatewayV1ProxyEvent(httpApiGatewayV2Event), false)
  assert.equal(isGatewayV1ProxyEvent(httpApiGatewayV2EventAlt), false)
  assert.equal(isGatewayV1ProxyEvent(lambdaV1InvocationEvent), false)
  assert.equal(isGatewayV1ProxyEvent(albEvent), true)
  assert.equal(isGatewayV1ProxyEvent(lambdaEvent), false)
  assert.equal(isGatewayV1ProxyEvent(lambdaAuthorizerEvent), false)
})

test('isGatewayV2ProxyEvent', () => {
  assert.equal(isGatewayV2ProxyEvent(restApiGatewayV1Event), false)
  assert.equal(isGatewayV2ProxyEvent(httpApiGatewayV1Event), false)
  assert.equal(isGatewayV2ProxyEvent(httpApiGatewayV2Event), true)
  assert.equal(isGatewayV2ProxyEvent(httpApiGatewayV2EventAlt), true)
  assert.equal(isGatewayV2ProxyEvent(lambdaV1InvocationEvent), false)
  assert.equal(isGatewayV2ProxyEvent(albEvent), false)
  assert.equal(isGatewayV2ProxyEvent(lambdaEvent), false)
  assert.equal(isGatewayV2ProxyEvent(lambdaAuthorizerEvent), false)
})
