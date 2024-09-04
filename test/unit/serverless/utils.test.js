/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { isGatewayV1Event, isGatewayV2Event } = require('../../../lib/serverless/api-gateway')
const {
  restApiGatewayV1Event,
  httpApiGatewayV1Event,
  httpApiGatewayV2Event,
  lambaV1InvocationEvent
} = require('./fixtures')

test('isGatewayV1Event', () => {
  assert.equal(isGatewayV1Event(restApiGatewayV1Event), true)
  assert.equal(isGatewayV1Event(httpApiGatewayV1Event), true)
  assert.equal(isGatewayV1Event(httpApiGatewayV2Event), false)
  assert.equal(isGatewayV1Event(lambaV1InvocationEvent), false)
})

test('isGatewayV2Event', () => {
  assert.equal(isGatewayV2Event(restApiGatewayV1Event), false)
  assert.equal(isGatewayV2Event(httpApiGatewayV1Event), false)
  assert.equal(isGatewayV2Event(httpApiGatewayV2Event), true)
  assert.equal(isGatewayV2Event(lambaV1InvocationEvent), false)
})
