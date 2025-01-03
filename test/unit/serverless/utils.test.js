/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const {
  isGatewayV1Event,
  isGatewayV2Event,
  isAlbEvent
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

test('isGatewayV1Event', () => {
  assert.equal(isGatewayV1Event(restApiGatewayV1Event), true)
  assert.equal(isGatewayV1Event(httpApiGatewayV1Event), true)
  assert.equal(isGatewayV1Event(httpApiGatewayV2Event), false)
  assert.equal(isGatewayV1Event(httpApiGatewayV2EventAlt), false)
  assert.equal(isGatewayV1Event(lambdaV1InvocationEvent), false)
  assert.equal(isGatewayV1Event(albEvent), false)
  assert.equal(isGatewayV1Event(lambdaEvent), false)
  assert.equal(isGatewayV1Event(lambdaAuthorizerEvent), false)
})

test('isGatewayV2Event', () => {
  assert.equal(isGatewayV2Event(restApiGatewayV1Event), false)
  assert.equal(isGatewayV2Event(httpApiGatewayV1Event), false)
  assert.equal(isGatewayV2Event(httpApiGatewayV2Event), true)
  assert.equal(isGatewayV2Event(httpApiGatewayV2EventAlt), true)
  assert.equal(isGatewayV2Event(lambdaV1InvocationEvent), false)
  assert.equal(isGatewayV2Event(albEvent), false)
  assert.equal(isGatewayV2Event(lambdaEvent), false)
  assert.equal(isGatewayV2Event(lambdaAuthorizerEvent), false)
})

test('isAlbEvent', () => {
  assert.equal(isAlbEvent(restApiGatewayV1Event), false)
  assert.equal(isAlbEvent(httpApiGatewayV1Event), false)
  assert.equal(isAlbEvent(httpApiGatewayV2Event), false)
  assert.equal(isAlbEvent(httpApiGatewayV2EventAlt), false)
  assert.equal(isAlbEvent(lambdaV1InvocationEvent), false)
  assert.equal(isAlbEvent(albEvent), true)
  assert.equal(isAlbEvent(lambdaEvent), false)
  assert.equal(isAlbEvent(lambdaAuthorizerEvent), false)
})
