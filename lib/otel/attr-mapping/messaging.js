/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// These mappings are compliant with v1.24.0 and have mappings with v1.20.0 of semantic conventions
// https://github.com/open-telemetry/semantic-conventions/blob/v1.24.0/docs/database/database-spans.md

const constants = require('../constants')
const createMapper = require('./utils')
const { DESTINATIONS } = require('../../config/attribute-filter')

// These mappings are compliant with v1.24.0 and have mappings with v1.20.0 of semantic conventions
// https://github.com/open-telemetry/semantic-conventions/blob/v1.24.0/docs/messaging/messaging-spans.md

const attrMappings = {
  conversationId: {
    attrs: [constants.ATTR_MESSAGING_MESSAGE_CONVERSATION_ID],
    mapping({ segment }) {
      return (value) => segment.addAttribute('correlation_id', value)
    }
  },
  destination: {
    attrs: [constants.ATTR_MESSAGING_DESTINATION_NAME, constants.ATTR_MESSAGING_DESTINATION],
    mapping({ transaction }) {
      const baseSegment = transaction.baseSegment
      const trace = transaction.trace
      const isHighSecurity = transaction.agent.config.high_security
      return (value) => {
        if (isHighSecurity === true) return
        trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'message.queueName', value)
        baseSegment.addAttribute('message.queueName', value)
      }
    }
  },
  operation: {
    attrs: [constants.ATTR_MESSAGING_OPERATION, constants.ATTR_MESSAGING_DESTINATION_KIND]
  },
  port: {
    attrs: [constants.ATTR_SERVER_PORT],
    mapping({ segment }) {
      return (value) => segment.addAttribute('port', value)
    }
  },
  rmqRoutingKey: {
    attrs: [constants.ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY],
    mapping({ segment, transaction }) {
      // indicates it is coming from consumer
      if (transaction) {
        const trace = transaction.trace
        const isHighSecurity = transaction.agent.config.high_security
        return (value) => {
          if (isHighSecurity === true) return
          trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'message.routingKey', value)
        }
      } else {
        return (value) => segment.addAttribute('routing_key', value)
      }
    }
  },
  server: {
    attrs: [constants.ATTR_SERVER_ADDRESS],
    mapping({ segment }) {
      return (value) => segment.addAttribute('host', value)
    }
  },
  system: {
    attrs: [constants.ATTR_MESSAGING_SYSTEM]
  }
}
const { getAttr: msgAttr, attributesMapper } = createMapper(attrMappings)

function consumerMapper({ transaction }) {
  const destMapping = attributesMapper({ key: 'destination', transaction })
  const portMapping = attributesMapper({ key: 'port', segment: transaction.baseSegment })
  const serverMapping = attributesMapper({ key: 'server', segment: transaction.baseSegment })
  const rmqRoutingKeyMapping = attributesMapper({ key: 'rmqRoutingKey', transaction })
  return {
    ...destMapping,
    ...portMapping,
    ...rmqRoutingKeyMapping,
    ...serverMapping
  }
}

function producerMapper({ segment }) {
  const conversationIdtMapping = attributesMapper({ key: 'conversationId', segment })
  const portMapping = attributesMapper({ key: 'port', segment })
  const serverMapping = attributesMapper({ key: 'server', segment })
  const rmqRoutingKeyMapping = attributesMapper({ key: 'rmqRoutingKey', segment })
  return {
    ...conversationIdtMapping,
    ...portMapping,
    ...rmqRoutingKeyMapping,
    ...serverMapping
  }
}

module.exports = {
  consumerMapper,
  producerMapper,
  msgAttr
}
