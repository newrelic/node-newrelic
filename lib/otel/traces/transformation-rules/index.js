/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = loadTransformationRules

const fs = require('node:fs')
const path = require('node:path')

/**
 * Reads and loads all transformation rule JSON files from the current directory.
 *
 * Files are expected to be named in the format: NNN-<rule_name>.json
 * where NNN is a zero-padded three-digit number.
 *
 * Numbering scheme by rule type:
 * - 100-199: Server rules (fallback at 199)
 * - 200-299: Consumer rules (fallback at 299)
 * - 300-399: Client rules (fallback at 399)
 * - 400-499: Producer rules (fallback at 499)
 * - 999: Internal fallback rule
 *
 * Within each category, rules are ordered from most specific to least specific,
 * with type-specific fallback rules positioned at X99 (e.g., 199, 299, 399, 499).
 * The final internal fallback rule (999) matches any span that doesn't match
 * any other rule.
 *
 * @returns {object[]} Array of transformation rules sorted by filename order
 */
function loadTransformationRules() {
  const rulesDir = __dirname
  const files = fs.readdirSync(rulesDir)

  // Filter for JSON files matching the pattern NNN-*.json and sort them
  const ruleFiles = files
    .filter((file) => /^\d{3}-.+\.json$/.test(file))
    .sort()

  const rules = []

  for (const file of ruleFiles) {
    const filePath = path.join(rulesDir, file)
    const content = fs.readFileSync(filePath, 'utf8')
    const rule = JSON.parse(content)
    rules.push(rule)
  }

  return rules
}
