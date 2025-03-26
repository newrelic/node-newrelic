/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { msgAttr, consumerMapper, producerMapper } = require('#agentlib/otel/attr-mapping/messaging.js')
const AttributeReconciler = require('#agentlib/otel/attr-reconciler.js')
const helper = require('#testlib/agent_helper.js')
const sinon = require('sinon')
const test = require('node:test')
const assert = require('node:assert')
const {
  ATTR_MESSAGING_MESSAGE_CONVERSATION_ID,
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
} = require('#agentlib/otel/constants.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    agent: helper.loadMockedAgent()
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('destination', () => {
  const span = {
    attributes: {
      [ATTR_MESSAGING_DESTINATION]: 'TestQueue'
    }
  }
  const value = msgAttr({ key: 'destination', span })
  assert.deepEqual(value, 'TestQueue')
})

test('operation', () => {
  const span = {
    attributes: {
      [ATTR_MESSAGING_DESTINATION_KIND]: 'topic'
    }
  }
  const value = msgAttr({ key: 'operation', span })
  assert.deepEqual(value, 'topic')
})

test('consumerMapper', (t) => {
  const { agent } = t.nr
  const span = {
    attributes: {
      [ATTR_MESSAGING_DESTINATION_NAME]: 'testQueue',
      [ATTR_SERVER_PORT]: 8892,
      [ATTR_SERVER_ADDRESS]: 'messaging-server',
      [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: 'routingKey'
    }
  }

  const transaction = {
    baseSegment: {
      addAttribute: sinon.stub()
    },
    agent,
    trace: {
      attributes: {
        addAttribute: sinon.stub()
      }
    }
  }
  const mapper = consumerMapper({ transaction })
  const reconciler = new AttributeReconciler({ agent })
  reconciler.reconcile({ segment: transaction.baseSegment, otelSpan: span, mapper })
  assert.equal(transaction.trace.attributes.addAttribute.callCount, 2)
  const [queue, routingKey] = transaction.trace.attributes.addAttribute.args
  assert.deepEqual(queue, [7, 'message.queueName', 'testQueue'])
  assert.deepEqual(routingKey, [7, 'message.routingKey', 'routingKey'])
  assert.equal(transaction.baseSegment.addAttribute.callCount, 3)
  const [queueName, port, host] = transaction.baseSegment.addAttribute.args
  assert.deepEqual(queueName, ['message.queueName', 'testQueue'])
  assert.deepEqual(port, ['port', 8892])
  assert.deepEqual(host, ['host', 'messaging-server'])
})

test('consumerMapper high security mode', (t) => {
  const { agent } = t.nr
  agent.config.high_security = true
  const span = {
    attributes: {
      [ATTR_MESSAGING_DESTINATION_NAME]: 'testQueue',
      [ATTR_SERVER_PORT]: 8892,
      [ATTR_SERVER_ADDRESS]: 'messaging-server',
      [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: 'routingKey'
    }
  }

  const transaction = {
    baseSegment: {
      addAttribute: sinon.stub()
    },
    agent,
    trace: {
      attributes: {
        addAttribute: sinon.stub()
      }
    }
  }
  const mapper = consumerMapper({ transaction })
  const reconciler = new AttributeReconciler({ agent })
  reconciler.reconcile({ segment: transaction.baseSegment, otelSpan: span, mapper })
  assert.equal(transaction.trace.attributes.addAttribute.callCount, 0)
  assert.equal(transaction.baseSegment.addAttribute.callCount, 2)
  const [port, host] = transaction.baseSegment.addAttribute.args
  assert.deepEqual(port, ['port', 8892])
  assert.deepEqual(host, ['host', 'messaging-server'])
})

test('producerMapper', (t) => {
  const { agent } = t.nr
  const span = {
    attributes: {
      [ATTR_MESSAGING_MESSAGE_CONVERSATION_ID]: 'id',
      [ATTR_SERVER_PORT]: 8892,
      [ATTR_SERVER_ADDRESS]: 'messaging-server',
      [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: 'routingKey'
    }
  }

  const segment = {
    addAttribute: sinon.stub()
  }

  const mapper = producerMapper({ segment })
  const reconciler = new AttributeReconciler({ agent })
  reconciler.reconcile({ segment, otelSpan: span, mapper })
  assert.equal(segment.addAttribute.callCount, 4)
  const [convoId, port, host, routingKey] = segment.addAttribute.args
  assert.deepEqual(convoId, ['correlation_id', 'id'])
  assert.deepEqual(port, ['port', 8892])
  assert.deepEqual(host, ['host', 'messaging-server'])
  assert.deepEqual(routingKey, ['routing_key', 'routingKey'])
})
