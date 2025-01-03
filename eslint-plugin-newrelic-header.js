/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const headerTmpl = `
/*
 * Copyright {{year}} New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
`.trim()

const rule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: false
  },

  create(context) {
    return {
      Program(node) {
        const src = context.sourceCode.getText()
        if (hasHeader(src) === true) {
          return
        }
        context.report({
          loc: node.loc,
          message: 'missing or invalid header',
          fix(fixer) {
            const rendered = headerTmpl.replace('{{year}}', new Date().getFullYear() + '') + '\n\n'
            if (hasShebang(src) === true) {
              return fixer.insertTextAfterRange([0, src.indexOf('\n')], '\n' + rendered)
            }
            return fixer.insertTextBefore(
              node,
              rendered
            )
          }
        })
      }
    }
  }
}

module.exports = {
  meta: {
    name: 'eslint-plugin-newrelic-header',
    version: '1.0.0'
  },
  rules: {
    header: rule
  }
}

function hasShebang(src) {
  return /^#!\s?\//.test(src)
}

function hasHeader(src) {
  const headerLines = src.split('\n').slice(0, 5)
  if (hasShebang(src) === true) {
    headerLines.shift()
  }
  return headerLines[0] === '/*' &&
    / \* Copyright \d{4} New Relic Corporation\. All rights reserved\./.test(headerLines[1]) === true &&
    / \* SPDX-License-Identifier: Apache-2\.0/.test(headerLines[2]) === true &&
    headerLines[3] === ' */'
}
