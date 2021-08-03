/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  "env": {
    "es6": true,
    "node": true,
    "browser": false
  },
  "parserOptions": {
    "ecmaVersion": "2019"
  },
  "plugins": [
    "header"
  ],
  "ignorePatterns": ["invalid-json/"],
  "rules": {
    "brace-style": "error",
    "comma-dangle": "off",
    "comma-style": ["error", "last"],
    "consistent-return": "off",
    "curly": "off",
    "eol-last": "error",
    "eqeqeq": ["error", "smart"],
    "camelcase": ["off", {"properties": "never"}],
    "dot-notation": "error",
    "func-names": "error",
    "guard-for-in": "error",
    "header/header": ["error", "block", [
      "",
      {"pattern": " * Copyright \\d{4} New Relic Corporation. All rights reserved."},
      " * SPDX-License-Identifier: Apache-2.0",
      " "
    ], 2],
    "indent": ["warn", 2, {"SwitchCase": 1}],
    "key-spacing": ["off", { "beforeColon": false }],
    "keyword-spacing": "error",
    "max-len": ["error", 100, { "ignoreUrls": true }],
    "max-nested-callbacks": ["error", 3],
    "max-params": ["error", 5],
    "new-cap": "error",
    "no-const-assign": "error",
    "no-console": "warn",
    "no-debugger": "error",
    "no-else-return": "error",
    "no-floating-decimal": "error",
    "no-lonely-if": "error",
    "no-mixed-requires": "error",
    "no-multiple-empty-lines": "error",
    "no-multi-spaces": ["off", { "ignoreEOLComments": true }],
    "no-new": "error",
    "no-new-func": "warn",
    "no-shadow": ["warn", {"allow": ["shim"]}],
    "no-undef": "error",
    "no-unused-vars": "error",
    "no-use-before-define": ["off", {"functions": false}],
    "one-var": ["off", "never"],
    "padded-blocks": ["error", "never"],
    "radix": "error",
    "semi": ["error", "never"],
    "space-before-function-paren": ["error", "never"],
    "space-before-blocks": "error",
    "space-infix-ops": "error",
    "spaced-comment": "error",
    "space-unary-ops": "error",
    "strict": "error",
    "quote-props": [ "off", "consistent-as-needed" ],
    "quotes": ["off", "single"],
    "use-isnan": "error",
    "wrap-iife": "error"
  },
  "overrides": [
    {
      "files": [
        "test/integration/*.tap.js",
        "test/integration/*/*.tap.js",
        "test/integration/core/exec-me.js"
      ],
      "rules": {
        "no-console": ["off"]
      }
    },
    {
      "files": [
        "newrelic.js"
      ],
      "rules": {
        "header/header": ["off"]
      }
    }
  ]
}
