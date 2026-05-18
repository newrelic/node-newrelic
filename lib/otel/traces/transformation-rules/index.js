'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Reads and loads all transformation rule JSON files from the current directory.
 * Files are expected to be named in the format: NNN-<rule_name>.json
 * where NNN is a zero-padded three-digit number (e.g., 001-OtelHttpServer1_23.json)
 *
 * @returns {Array<Object>} Array of transformation rules sorted by filename order
 */
function loadTransformationRules() {
  const rulesDir = __dirname
  const files = fs.readdirSync(rulesDir)

  // Filter for JSON files matching the pattern NNN-*.json and sort them
  const ruleFiles = files
    .filter(file => /^\d{3}-.+\.json$/.test(file))
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

module.exports = loadTransformationRules()
