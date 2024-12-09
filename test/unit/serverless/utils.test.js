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
  lambaV1InvocationEvent,
  albEvent,
  lambdaEvent
} = require('./fixtures')

test('isGatewayV1Event', () => {
  assert.equal(isGatewayV1Event(restApiGatewayV1Event), true)
  assert.equal(isGatewayV1Event(httpApiGatewayV1Event), true)
  assert.equal(isGatewayV1Event(httpApiGatewayV2Event), false)
  assert.equal(isGatewayV1Event(httpApiGatewayV2EventAlt), false)
  assert.equal(isGatewayV1Event(lambaV1InvocationEvent), false)
  assert.equal(isGatewayV1Event(albEvent), false)
  assert.equal(isGatewayV1Event(lambdaEvent), false)
})

test('isGatewayV2Event', () => {
  assert.equal(isGatewayV2Event(restApiGatewayV1Event), false)
  assert.equal(isGatewayV2Event(httpApiGatewayV1Event), false)
  assert.equal(isGatewayV2Event(httpApiGatewayV2Event), true)
  assert.equal(isGatewayV2Event(httpApiGatewayV2EventAlt), true)
  assert.equal(isGatewayV2Event(lambaV1InvocationEvent), false)
  assert.equal(isGatewayV2Event(albEvent), false)
  assert.equal(isGatewayV2Event(lambdaEvent), false)
})

test('isAlbEvent', () => {
  assert.equal(isAlbEvent(restApiGatewayV1Event), false)
  assert.equal(isAlbEvent(httpApiGatewayV1Event), false)
  assert.equal(isAlbEvent(httpApiGatewayV2Event), false)
  assert.equal(isAlbEvent(httpApiGatewayV2EventAlt), false)
  assert.equal(isAlbEvent(lambaV1InvocationEvent), false)
  assert.equal(isAlbEvent(albEvent), true)
  assert.equal(isAlbEvent(lambdaEvent), true)
})
