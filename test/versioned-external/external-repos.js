/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * name: folder name to checkout the repo into.
 * repository: repo URL to clone from.
 * branch: branch to checkout
 * additionalFiles: String array of files/folders to checkout in addition to lib and tests/versioned.
 */
const repos = [
  {
    name: 'aws-sdk',
    repository: 'https://github.com/newrelic/node-newrelic-aws-sdk.git',
    branch: 'main'
  },
  {
    name: 'next',
    repository: 'https://github.com/newrelic/newrelic-node-nextjs.git',
    branch: 'main'
  },
  {
    name: 'apollo-server',
    repository: 'https://github.com/newrelic/newrelic-node-apollo-server-plugin.git',
    branch: 'main',
    additionalFiles: [
      'tests/agent-testing.js',
      'tests/create-apollo-server-setup.js',
      'tests/data-definitions.js',
      'tests/metrics-tests.js',
      'tests/test-client.js',
      'tests/utils.js'
    ]
  }
]

module.exports = repos
