/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const helper = require('#testlib/agent_helper.js')
const AttributeReconciler = require('#agentlib/otel/traces/attr-reconciler.js')
const {
  ATTR_NET_HOST_NAME,
  ATTR_NET_PEER_NAME,
  ATTR_SERVER_ADDRESS
} = require('#agentlib/otel/traces/constants.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const reconciler = new AttributeReconciler({ agent })
  const segment = {
    addAttribute: sinon.stub()
  }
  ctx.nr = { agent, reconciler, segment }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('isHostnameKey returns true for recognized hostname attributes', (t) => {
  const { reconciler } = t.nr
  for (const key of [ATTR_NET_HOST_NAME, ATTR_NET_PEER_NAME, ATTR_SERVER_ADDRESS]) {
    assert.equal(reconciler.isHostnameKey(key), true)
  }
})

test('isHostnameKey returns false for an unrecognized attribute', (t) => {
  const { reconciler } = t.nr
  assert.equal(reconciler.isHostnameKey('some.other.key'), false)
})

test('resolveHost returns the safe hostname for localhost', (t) => {
  const { agent, reconciler } = t.nr
  const expected = agent.config.getHostnameSafe()
  assert.equal(reconciler.resolveHost('localhost'), expected)
  assert.equal(reconciler.resolveHost('127.0.0.1'), expected)
})

test('resolveHost returns the hostname as-is when it is not localhost', (t) => {
  const { reconciler } = t.nr
  assert.equal(reconciler.resolveHost('newrelic.com'), 'newrelic.com')
})

test('reconcile adds every attribute on the span to the segment', (t) => {
  const { reconciler, segment } = t.nr
  const otelSpan = {
    attributes: {
      'custom.key': 'custom-value',
      'another.key': 'another-value'
    }
  }

  reconciler.reconcile({ segment, otelSpan })

  assert.equal(segment.addAttribute.callCount, 2)
  assert.ok(segment.addAttribute.calledWith('custom.key', 'custom-value', false))
  assert.ok(segment.addAttribute.calledWith('another.key', 'another-value', false))
})

test('reconcile resolves hostname attributes before adding them', (t) => {
  const { agent, reconciler, segment } = t.nr
  const expectedHost = agent.config.getHostnameSafe()
  const otelSpan = {
    attributes: {
      [ATTR_SERVER_ADDRESS]: 'localhost'
    }
  }

  reconciler.reconcile({ segment, otelSpan })

  assert.ok(segment.addAttribute.calledWith(ATTR_SERVER_ADDRESS, expectedHost, false))
})

test('reconcile skips attributes already handled by `excludeAttributes`', (t) => {
  const { reconciler, segment } = t.nr
  const otelSpan = {
    attributes: {
      'custom.key': 'custom-value',
      'excluded.key': 'excluded-value'
    }
  }

  reconciler.reconcile({ segment, otelSpan, excludeAttributes: new Set(['excluded.key']) })

  assert.equal(segment.addAttribute.callCount, 1)
  assert.ok(segment.addAttribute.calledWith('custom.key', 'custom-value', false))
})

test('reconcile marks attributes as truncation exempt when they match `config.otel_gen_ai_attrs`', (t) => {
  const { agent, reconciler, segment } = t.nr
  agent.config.otel_gen_ai_attrs = ['gen_ai.input.messages']
  const longValue = 'x'.repeat(500)
  const otelSpan = {
    attributes: {
      'gen_ai.input.messages': longValue,
      'gen_ai.other.attribute': longValue
    }
  }

  reconciler.reconcile({ segment, otelSpan })

  assert.ok(segment.addAttribute.calledWith('gen_ai.input.messages', longValue, true))
  assert.ok(segment.addAttribute.calledWith('gen_ai.other.attribute', longValue, false))
})

test('reconcile does not mark attributes as truncation exempt when `config.otel_gen_ai_attrs` is empty', (t) => {
  const { agent, reconciler, segment } = t.nr
  agent.config.otel_gen_ai_attrs = []
  const otelSpan = {
    attributes: {
      'gen_ai.input.messages': 'a short value'
    }
  }

  reconciler.reconcile({ segment, otelSpan })

  assert.ok(segment.addAttribute.calledWith('gen_ai.input.messages', 'a short value', false))
})
