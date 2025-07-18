/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const helper = require('../../lib/agent_helper')

const {
  testAsCallbackBehavior,
  testCatchBehavior,
  testFinallyBehavior,
  testFromCallbackBehavior,
  testRejectBehavior,
  testResolveBehavior,
  testThrowBehavior,
  testTryBehavior,
} = require('./common-tests')
const {
  areMethodsWrapped,
} = require('./helpers')

testTryBehavior('try')
testTryBehavior('attempt')
testResolveBehavior('cast')
testResolveBehavior('fulfilled')
testResolveBehavior('resolve')
testThrowBehavior('thenThrow')
testThrowBehavior('throw')
testFromCallbackBehavior('fromCallback')
testFromCallbackBehavior('fromNode')
testFinallyBehavior('finally')
testFinallyBehavior('lastly')
testRejectBehavior('reject')
testRejectBehavior('rejected')
testAsCallbackBehavior('asCallback')
testAsCallbackBehavior('nodeify')
testCatchBehavior('catch')
testCatchBehavior('caught')

test('bluebird static and instance methods check', function (t) {
  helper.loadTestAgent(t)
  const Promise = require('bluebird')

  areMethodsWrapped(Promise)
  areMethodsWrapped(Promise.prototype)
})
