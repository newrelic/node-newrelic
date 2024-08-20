/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { isGatewayV1Event, isGatewayV2Event } = require('../../../lib/serverless/api-gateway')
const { gatewayV1Event, gatewayV2Event, lambaV1InvocationEvent } = require('./fixtures')

test('isGatewayV1Event', () => {
  assert.equal(isGatewayV1Event(gatewayV1Event), true)
  assert.equal(isGatewayV1Event(gatewayV2Event), false)
  assert.equal(isGatewayV1Event(lambaV1InvocationEvent), false)
})

test('isGatewayV2Event', () => {
  assert.equal(isGatewayV2Event(gatewayV1Event), false)
  assert.equal(isGatewayV2Event(gatewayV2Event), true)
  assert.equal(isGatewayV2Event(lambaV1InvocationEvent), false)
})
