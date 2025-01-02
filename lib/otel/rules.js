/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const srcJson = require('./rules.json')

/**
 * Mapping rules are stored, and provided to the agent, as JSON. We call these
 * representations `SerializedOtelMappingRule`.
 *
 * TODO: rewrite all of this once the spec inventor settles on a final shape.
 *
 * @typedef {object} SerializedOtelMappingRule
 * @property {string} name The name of the rule. This will be used to detect
 * the kind of span (server or client).
 * @property {object} matcher Defines the required properties of the OTEL span
 * that are needed in order for the rule to match.
 * @property {string[]} matcher.required_metric_names The metrics present
 * on the span that must be present. When not set, the rule does not match
 * metrics.
 * @property {string} [matcher.metric_assumed_unit] Specifies the unit to
 * use when the metric does not include a specifier. When not set, the rule does
 * not match metrics. TODO: what are the possible units?
 * @property {string} [matcher.metric_unit_validator] An identifier for a
 * validator to be used to validate the metric's unit. Not applicable if the
 * rule is not matching a metric.
 * @property {string[]} matcher.required_span_kinds List of OTEL span kinds that
 * this rule will match. Possible values are "server", "client", and "internal".
 * @property {string[]} matcher.required_attribute_keys List of OTEL span
 * attributes that must be present for the rule to match. Each value is a dot
 * separated path.
 * @property {object} target Describes the New Relic entity(ies) that the rule
 * will map to.
 * @property {string[]} target.target_metrics The
 * @property {object[{attribute, template}]} target.attribute_mappings
 */

/**
 * Represents an OTEL to New Relic span mapping rule.
 */
class Rule {
  static OTEL_SPAN_KIND_SERVER = 'server'
  static OTEL_SPAN_KIND_CLIENT = 'client'
  static OTEL_SPAN_KIND_PRODUCER = 'producer'
  static OTEL_SPAN_KIND_INTERNAL = 'internal'

  #name
  #spanKinds
  #requiredAttributes
  #type
  #mappings

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
    this.#spanKinds = input.matcher.required_span_kinds?.map((v) => v.toLowerCase()) ?? []
    this.#requiredAttributes = input.matcher.required_attribute_keys ?? []
    this.#mappings = input.target.attribute_mappings ?? []
  }

  get name() {
    return this.#name
  }

  get type() {
    if (this.#type) {
      return this.#type
    }
    return this.isServerRule ? 'server' : 'client'
  }

  get isClientRule() {
    return this.#spanKinds.includes(Rule.OTEL_SPAN_KIND_CLIENT)
  }

  get isConsumer() {
    return this.#spanKinds.includes('consumer')
  }

  get isInternalRule() {
    return this.#spanKinds.includes('internal')
  }

  get isProducerRule() {
    return this.#spanKinds.includes(Rule.OTEL_SPAN_KIND_PRODUCER)
  }

  get isServerRule() {
    return this.#spanKinds.includes(Rule.OTEL_SPAN_KIND_SERVER) || this.isConsumer
  }

  /**
   * Determines if the given span satifies this rule's requirements.
   *
   * @param {object} span An OTEL span instance.
   *
   * @returns {boolean} `true` if the span satisfies the rule.
   */
  matches(span) {
    let result = false

    let attrCount = 0
    for (const attr of this.#requiredAttributes) {
      if (Object.hasOwn(span.attributes, attr) === true) {
        attrCount += 1
      }
    }
    if (attrCount === this.#requiredAttributes.length) {
      result = true
    }

    return result
  }
}

class RulesEngine {
  #serverRules = new Map()
  #fallbackServerRules = new Map()
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
      } else if (rule.isClientRule === true) {
        this.#clientRules.set(rule.name, rule)
      }
    }
  }

  /**
   * Determines if the span matches any known rules. If the span matches, then
   * the matching rule will be returned.
   *
   * @param {object} otelSpan The span to test.
   *
   * @returns {Rule|undefined}
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  test(otelSpan) {
    let result

    // eslint-disable-next-line sonarjs/no-labels, no-labels
    detector: switch (otelSpan.kind) {
      case SpanKind.SERVER:
      case SpanKind.CONSUMER: {
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
