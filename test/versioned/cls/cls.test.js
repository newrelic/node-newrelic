/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')

test('we do not interfere with cls operations and contexts', (t, end) => {
  const cls = require('continuation-local-storage')
  const agent = helper.instrumentMockedAgent({
    feature_flag: { promise_segments: false }
  })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const ns = cls.createNamespace('testing')

  ns.run(() => {
    ns.set('foo', 'foo')
    helper.runInTransaction(agent, (tx) => {
      ns.set('bar', 'bar')
      setTimeout(() => {
        const ns2 = cls.getNamespace('testing')
        assert.equal(ns2.get('foo'), 'foo')
        assert.equal(ns2.get('bar'), 'bar')
        assert.equal(agent.getTransaction(), tx, 'should maintain tx state')
        end()
      }, 0)
    })
  })
})
