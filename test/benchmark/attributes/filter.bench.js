/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const AttributeFilter = require('../../../lib/config/attribute-filter')
const benchmark = require('../../lib/benchmark')
const { makeAttributeFilterConfig } = require('../../lib/agent_helper')

const suite = benchmark.createBenchmark({
  name: 'config.filter'
})

const filter = makeFilter({
  attributes: {
    enabled: true,
    include: [
      'request.headers.global-include-exact',
      'request.headers.global-include-other',
      'request.headers.global-include-wild*',
      'request.headers.global-include-other*',
      'request.uri'
    ],
    exclude: [
      'request.headers.global-exclude-exact',
      'request.headers.global-exclude-other',
      'request.headers.global-exclude-wild*',
      'request.headers.global-exclude-other*'
    ]
  },
  transaction_tracer: {
    attributes: {
      enabled: true,
      include: [
        'request.headers.tt-include-exact',
        'request.headers.tt-include-other',
        'request.headers.tt-include-wild*',
        'request.headers.tt-include-other*'
      ],
      exclude: [
        'request.headers.tt-exclude-exact',
        'request.headers.tt-exclude-other',
        'request.headers.tt-exclude-wild*',
        'request.headers.tt-exclude-other*'
      ]
    }
  }
})

const attributes = [
  'request.headers.global-include-exact',
  'request.headers.global-include-wildcard',

  'request.headers.global-exclude-exact',
  'request.headers.global-exclude-wildcard',

  'request.headers.tt-include-exact',
  'request.headers.tt-include-wildcard',

  'request.headers.tt-exclude-exact',
  'request.headers.tt-exclude-wildcard',

  'request.headers.no-rules-match'
]

attributes.forEach(function (attr) {
  suite.add({
    name: attr,
    fn: function () {
      return filter.filterTransaction(AttributeFilter.DESTINATIONS.TRANS_TRACE, attr)
    }
  })
})

suite.run()

function makeFilter(rules) {
  const config = makeAttributeFilterConfig(rules)
  config.attributes.filter_cache_limit = 1000
  return new AttributeFilter(config)
}
