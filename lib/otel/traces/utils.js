/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')

/**
 * Transforms a template string by replacing placeholders with values from the data object.
 * If a key is not found in the data object, it returns 'unknown'.
 * If a key is found in the rules object, it applies the corresponding function to the value.
 * @param {string} template - The template string containing placeholders in the format ${key}.
 * @param {object} data - An object containing key-value pairs to replace in the template.
 * @param {object} rules - An optional object containing functions to apply to specific keys.
 * @returns {string} - The transformed string with placeholders replaced by corresponding values.
 */
function transformTemplate(template, data, rules = {}) {
  return template.replace(/\${(.*?)}/g, (_, key) => {
    if (key in data) {
      if (key in rules) {
        return rules[key](data[key])
      } else {
        // We use || here instead of ?? because we could be comparing against
        // an empty string, not `null` or `undefined`.
        return data[key] || 'unknown'
      }
    } else {
      return 'unknown'
    }
  })
}

/**
 * Builds a set of rules from an array of mappings.
 * Each mapping should have a key, arguments, and body.
 * The body should be a string that can be evaluated as a function.
 * @param {Array} mappings - Array of mappings with key, arguments, and body.
 * @returns {object} - An object where each key maps to a function.
 */
function buildRuleMappings(mappings = []) {
  return mappings.reduce((acc, attr) => {
    if (attr?.key && attr?.arguments && attr?.body) {
      // eslint-disable-next-line no-new-func,sonarjs/code-eval
      acc[attr.key] = new Function(attr.arguments, attr.body)
    }
    return acc
  }, {})
}
/**
 * Processes a regex match and adds attributes to the segment based on the regex groups.
 * @param {object} params - The parameters for the regex processing.
 * @param {object} params.segment - The segment to add attributes to.
 * @param {object} params.transaction - The transaction object.
 * @param {object} params.regex - The regex to use for matching.
 * @param {string} params.value - The value to match against the regex.
 */
function processRegex({ segment, transaction, regex, value }) {
  const re = new RegExp(regex.statement, regex.flags)
  let regexMatches
  if (regex?.flags?.includes('g') === true) {
    regexMatches = Array.from(value.matchAll(re))
  } else {
    const regexMatch = value.match(re)
    regexMatches = regexMatch ? [regexMatch] : []
  }

  if (regexMatches.length) {
    for (const regexMatch of regexMatches) {
      processRegexGroups({ segment, groups: regex.groups, regexMatch, transaction })

      if (regex?.name && regex?.value && regex.prefix) {
        assignToTarget({
          segment,
          target: regex.target,
          transaction,
          name: `${regex.prefix}${regexMatch[regex.name]}`,
          value: regexMatch[regex.value]
        })
      }
    }
  }
}

/**
 * Processes the regex groups and adds attributes to the segment based on the regex match.
 * @param {object} params - The parameters for the regex group processing.
 * @param {object} params.segment - The segment to add attributes to.
 * @param {object} params.transaction - The transaction object.
 * @param {Array} params.groups - The regex groups to process.
 * @param {object} params.regexMatch - The regex match object containing the matched groups.
 */
function processRegexGroups({ segment, transaction, groups = [], regexMatch }) {
  for (const g of groups) {
    const value = regexMatch[g.group]
    if (g?.regex?.statement && value) {
      processRegex({ segment, transaction, regex: g.regex, value })
    } else if (g?.name && value) {
      assignToTarget({
        segment,
        target: g.target,
        transaction,
        name: g.name,
        value
      })
    }
  }
}

/**
 * Extracts the value of an attribute from a span, based on its key, value, or template.
 * If the attribute has a key, it will be used to get the value from the span's attributes.
 * If the attribute has a value, it will be used directly.
 * If the attribute has a template, it will be transformed using the span's attributes and any provided mappings.
 * @param {object} params - The parameters for extracting the attribute value.
 * @param {string} params.accountId - The value of agent.config.cloud.account_id
 * @param {object} params.attribute - The attribute object containing key, value, or template.
 * @param {Set} params.excludeAttributes - A set to keep track of excluded attributes.
 * @param {object} params.span - The span object containing attributes.
 * @returns {string} - The extracted value of the attribute.
 */
function extractAttributeValue({ accountId, attribute, excludeAttributes, span }) {
  const { key, mappings, name, template } = attribute
  let value
  if (key) {
    value = span.attributes[key]
    excludeAttributes.add(key)
  } else if (attribute?.value) {
    value = attribute.value
    excludeAttributes.add(name)
  } else if (template) {
    const rules = buildRuleMappings(mappings)
    value = transformTemplate(template, { ...span?.attributes, accountId }, rules)
  }

  return value
}

/**
 * Assigns a value to a target based on the specified target type.
 * @param {object} params - The parameters for assigning the value.
 * @param {object} params.segment - The segment to add the attribute to.
 * @param {string} params.target - The target type ('transaction', 'trace', or 'segment').
 * @param {object} params.transaction - The transaction object.
 * @param {string} params.name - The name of the attribute.
 * @param {string} params.value - The value of the attribute.
 */
function assignToTarget({ segment, target, transaction, name, value }) {
  if (target === 'transaction') {
    transaction[name] = value
  } else if (target === 'trace') {
    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, name, value)
  } else if (target === 'segment') {
    segment.addAttribute(name, value)
  }
}

module.exports = {
  assignToTarget,
  buildRuleMappings,
  extractAttributeValue,
  processRegex,
  transformTemplate
}
