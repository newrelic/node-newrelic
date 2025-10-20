/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const srcJson = require('./transformation-rules.json')

/**
 * Mapping rules are stored, and provided to the agent, as JSON. We call these
 * representations `SerializedOtelMappingRule`.
 *
 *
 * @typedef {object} SerializedOtelMappingRule
 * @property {string} name The name of the rule. This will be used to detect
 * @property {string} type The type of the rule. This will be used to detect the type of segment/transaction to create.
 * @property {object} matcher Defines the required properties of the OTEL span
 * that are needed in order for the rule to match.
 * @property {string[]} matcher.required_span_kinds List of OTEL span kinds that
 * this rule will match. Possible values are "server", "client", and "internal".
 * @property {string[]} matcher.required_attribute_keys List of OTEL span
 * attributes that must be present for the rule to match. Each value is a dot
 * separated path.
 * @property {object} matcher.attribute_conditions List of OTEL span
 * attributes that must contain a value in the array.
 * separated path.
 * @property {Array} attributes The attributes to map to a given target(segment/transaction/trace).
 * @property {object} transaction The transformation to apply to the transaction.
 * @property {object} segment The transformation to apply to the segment.
 */

/**
 * Represents an OTEL to New Relic span mapping rule.
 */
class Rule {
  static OTEL_SPAN_KIND_SERVER = 'server'
  static OTEL_SPAN_KIND_CLIENT = 'client'
  static OTEL_SPAN_KIND_PRODUCER = 'producer'
  static OTEL_SPAN_KIND_CONSUMER = 'consumer'
  static OTEL_SPAN_KIND_INTERNAL = 'internal'

  #name
  #spanKinds
  #requiredAttributes
  #requiredConditions
  #type
  #attributes
  #segmentTransformation
  #txTransformation

  /**
   * @param {SerializedOtelMappingRule} input A serialized rule to parse.
   */
  constructor(input) {
    // See https://opentelemetry.io/docs/specs/otel/trace/api/#spankind for
    // information about how OTEL classifies server vs client.

    if (Object.hasOwn(input.matcher, 'required_span_kinds') === false) {
      throw Error('we only support "span" matching rules')
    }

    this.#name = input.name
    this.#type = input.type
    this.#attributes = input.attributes ?? []
    this.#txTransformation = input.transaction ?? {}
    this.#segmentTransformation = input.segment ?? {}
    this.#spanKinds = input?.matcher?.required_span_kinds?.map((v) => v.toLowerCase()) ?? []
    this.#requiredAttributes = input?.matcher?.required_attribute_keys ?? []
    this.#requiredConditions = input?.matcher?.attribute_conditions ?? {}
  }

  get name() {
    return this.#name
  }

  get type() {
    return this.#type
  }

  get attributes() {
    return this.#attributes
  }

  set txTransformation(value) {
    this.#txTransformation = value
  }

  get txTransformation() {
    return this.#txTransformation
  }

  get segmentTransformation() {
    return this.#segmentTransformation
  }

  get isClientRule() {
    return this.#spanKinds.includes(Rule.OTEL_SPAN_KIND_CLIENT)
  }

  get isInternalRule() {
    return this.#spanKinds.includes('internal')
  }

  get isProducerRule() {
    return this.#spanKinds.includes(Rule.OTEL_SPAN_KIND_PRODUCER)
  }

  get isConsumerRule() {
    return this.#spanKinds.includes(Rule.OTEL_SPAN_KIND_CONSUMER)
  }

  get isServerRule() {
    return this.#spanKinds.includes(Rule.OTEL_SPAN_KIND_SERVER)
  }

  /**
   * Determines if the given span satisfies this rule's requirements.
   *
   * @param {object} span An OTEL span instance.
   *
   * @returns {boolean} `true` if the span satisfies the rule.
   */
  matches(span) {
    let result = false

    let attrCount = 0
    let attrConditions = 0
    for (const attr of this.#requiredAttributes) {
      if (Object.hasOwn(span.attributes, attr) === true) {
        attrCount += 1
      }
    }

    for (const [key, value] of Object.entries(this.#requiredConditions)) {
      if ((Array.isArray(value) && value.includes(span.attributes[key])) || span.attributes[key] === value) {
        attrConditions += 1
      }
    }

    if (attrCount === this.#requiredAttributes.length && attrConditions === Object.keys(this.#requiredConditions).length) {
      result = true
    }

    return result
  }
}

class RulesEngine {
  #serverRules = new Map()
  #consumerRules = new Map()
  #producerRules = new Map()
  #fallbackServerRules = new Map()
  #fallbackConsumerRules = new Map()
  #clientRules = new Map()
  #fallbackClientRules = new Map()
  #fallbackInternalRules = new Map()
  #fallbackProducerRules = new Map()

  constructor() {
    for (const inputRule of srcJson) {
      const rule = new Rule(inputRule)

      if (/fallback/i.test(rule.name) === true) {
        if (rule.isServerRule === true) {
          this.#fallbackServerRules.set(rule.name, rule)
        } else if (rule.isConsumerRule === true) {
          this.#fallbackConsumerRules.set(rule.name, rule)
        } else if (rule.isClientRule === true) {
          this.#fallbackClientRules.set(rule.name, rule)
        } else if (rule.isProducerRule === true) {
          this.#fallbackProducerRules.set(rule.name, rule)
        } else if (rule.isInternalRule === true) {
          this.#fallbackInternalRules.set(rule.name, rule)
        }
        continue
      }

      if (rule.isServerRule === true) {
        this.#serverRules.set(rule.name, rule)
      } else if (rule.isConsumerRule === true) {
        this.#consumerRules.set(rule.name, rule)
      } else if (rule.isClientRule === true) {
        this.#clientRules.set(rule.name, rule)
      } else if (rule.isProducerRule === true) {
        this.#producerRules.set(rule.name, rule)
      }
    }
  }

  /**
   * Determines if the span matches any known rules. If the span matches, then
   * the matching rule will be returned.
   *
   * @param {object} otelSpan The span to test.
   *
   * @returns {Rule|undefined} The matching rule, or `undefined` if no rules match.
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  test(otelSpan) {
    let result

    // eslint-disable-next-line sonarjs/no-labels, no-labels
    detector: switch (otelSpan.kind) {
      case SpanKind.SERVER: {
        for (const rule of this.#serverRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            // eslint-disable-next-line no-labels
            break detector
          }
        }
        for (const rule of this.#fallbackServerRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            break
          }
        }
        break
      }

      case SpanKind.CONSUMER: {
        for (const rule of this.#consumerRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            // eslint-disable-next-line no-labels
            break detector
          }
        }
        for (const rule of this.#fallbackConsumerRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            break
          }
        }
        break
      }

      case SpanKind.CLIENT: {
        for (const rule of this.#clientRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            // eslint-disable-next-line no-labels
            break detector
          }
        }
        for (const rule of this.#fallbackClientRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            break
          }
        }
        break
      }

      // there currently are no producer rules, just fallback
      // if we add new rules they will have to be wired up
      case SpanKind.PRODUCER: {
        for (const rule of this.#producerRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            // eslint-disable-next-line no-labels
            break detector
          }
        }
        for (const rule of this.#fallbackProducerRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            break
          }
        }
        break
      }

      // there currently are no internal rules, just fallback
      // if we add new rules they will have to be wired up
      case SpanKind.INTERNAL: {
        for (const rule of this.#fallbackInternalRules.values()) {
          if (rule.matches(otelSpan) === true) {
            result = rule
            break
          }
        }
        break
      }
    }

    return result
  }
}

module.exports = { RulesEngine, Rule }
