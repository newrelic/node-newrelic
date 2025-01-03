/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const neostandard = require('neostandard')
const jsdoc = require('eslint-plugin-jsdoc')
const sonarjs = require('eslint-plugin-sonarjs')
const header = require('./eslint-plugin-newrelic-header.js')

// The new eslint configuration format is a simple array of configuration
// objects. See https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects.
//
// While working on the config, it can be helpful to run:
//  npx @eslint/config-inspector

// This should be used to override rules we don't need applied to our
// test suites.
const testFiles = [
  'test/benchmark/**',
  'test/integration/**',
  'test/unit/**',
  'test/smoke/**',
  'test/versioned/**',
  'bin/test/**'
]

// See https://eslint.org/docs/latest/use/configure/ignore#ignoring-files
const globalIgnores = {
  ignores: [
    '**/node_modules/**',
    'docs/',
    'out/', // Compiled jsdocs directory.
    'test/versioned-external',
    'test/versioned/nextjs/app',
    'test/versioned/nextjs/app-dir'
  ]
}

const localConfig = {
  plugins: {
    header
  },

  rules: {
    'consistent-return': 'off',
    'no-console': 'warn',

    // Enable file header checking and autocorrection.
    'header/header': 'error',

    // This one enforces `!!thing` syntax, which some folks find difficult
    // to read:
    'no-unneeded-ternary': 'off',

    // There are times we'd rather have import statements close to the
    // thing that needed them:
    'import-x/first': 'off',

    // Prefer single quotes, but utilize others to avoid escaping:
    '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],

    // These rules would be too disruptive for an initial migration to
    // neostandard:
    '@stylistic/space-before-function-paren': 'off'
  },

  linterOptions: {
    reportUnusedDisableDirectives: 'error'
  }
}

const newrelicConfigOverrides = {
  files: ['**/newrelic.js', '**/newrelic.mjs'],
  rules: {
    'header/header': 'off'
  }
}

const sonarjsTestsConfig = {
  files: testFiles,

  rules: {
    // We sometimes need to shadow things like Promise for testing:
    'sonarjs/no-globals-shadowing': 'off',
    // Sonar doesn't like our test files that build tests:
    'sonarjs/no-empty-test-file': 'off',
    // Some of our tests hit local HTTP endpoints:
    'sonarjs/no-clear-text-protocols': 'off',
    // We don't always need secure random in tests:
    'sonarjs/pseudo-random': 'off',
    // We need to use `os.exec` and such at times:
    'sonarjs/os-command': 'off',
    'sonarjs/no-os-command-from-path': 'off',
    // We have to use bunk passwords in tests:
    'sonarjs/no-hardcoded-passwords': 'off', // eslint-disable-line
    // We will have slow regular expressions in tests and it is okay:
    'sonarjs/slow-regex': 'off',
    // The x-powered-by header has no bearing on the quality of our tests:
    'sonarjs/x-powered-by': 'off',
    // We sometimes need to build new functions via `new Function`:
    'sonarjs/code-eval': 'off',
    'no-new-func': 'off',
    // Sometimes we add dummy values that sonar doesn't like:
    'sonarjs/no-hardcoded-ip': 'off',
    // We need some side effect constructors in tests:
    'sonarjs/constructor-for-side-effects': 'off',
    // Tests don't need "safe" permissions:
    'sonarjs/file-permissions': 'off',
  }
}

const sonarjsOverrides = {
  rules: {
    // This rule picks up inlined lambda functions as a violation:
    'sonarjs/no-nested-functions': 'off',

    // Don't bug us. We'll get to it (maybe):
    'sonarjs/todo-tag': 'warn',
    'sonarjs/fixme-tag': 'warn',

    // Sonar be on that stuff. `static readonly FOO` is not valid JavaScript:
    'sonarjs/public-static-readonly': 'off',

    // Agree to disagree on their explanation for this one:
    'sonarjs/no-parameter-reassignment': 'off'
  }
}

const jsdocConfig = {
  plugins: { jsdoc },
  rules: {
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/tag-lines': 'off',
    'jsdoc/check-types': 'off',
    'jsdoc/no-undefined-types': [
      'warn',
      {
        definedTypes: [
          'Logger',
          'Agent',
          'Shim',
          'MessageShim',
          'TraceSegment',
          'Transaction',
          'Tracer',
          'Exception',
          'MetricAggregator',
          'EventEmitter'
        ]
      }
    ]
  }
}
const jsdocOverrides = {
  files: [
    './lib/shim/*.js',
    'lib/transaction/handle.js',
    'api.js'
  ],
  rules: {
    'jsdoc/require-jsdoc': 'warn'
  }
}

const nodeRecommended = neostandard.plugins.n.configs['flat/recommended']
delete nodeRecommended.languageOptions.sourceType
nodeRecommended.rules['n/no-unsupported-features/node-builtins'] = ['error', { version: '>=18.8.0' }]
nodeRecommended.rules['n/no-process-exit'] = 'off'
nodeRecommended.ignores = testFiles

// Configuration objects are merged in order. That is, the last object in the
// list will merge with objects earlier in the list. This allows for overriding
// any settings by adding objects to the end of the list.
// See:
// + https://eslint.org/docs/latest/use/configure/configuration-files#cascading-configuration-objectsar
// + https://eslint.org/blog/2022/08/new-config-system-part-2/#goodbye-extends%2C-hello-flat-cascade
module.exports = [
  // Apply baseline configuration.
  ...neostandard(),

  // Add sonarjs config:
  sonarjs.configs.recommended,
  sonarjsTestsConfig,
  sonarjsOverrides,

  // Add jsdoc config:
  jsdoc.configs['flat/recommended'],
  jsdocConfig,
  jsdocOverrides,

  // Add customized eslint-plugin-n recommended rules:
  nodeRecommended,
  {
    files: [
      'bin/*.js'
    ],
    rules: {
      'n/hashbang': 'off'
    }
  },

  // Apply local configuration and overrides:
  localConfig,
  newrelicConfigOverrides,
  globalIgnores
]
