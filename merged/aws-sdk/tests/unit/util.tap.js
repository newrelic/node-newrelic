/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'
const tap = require('tap')
const {grabLastUrlSegment} = require('../../lib/util')
tap.test('Utility Functions', (t) => {
  t.ok(grabLastUrlSegment, 'imported function successfully')

  const fixtures = [
    {
      input: '/foo/baz/bar',
      output: 'bar'
    },
    {
      input: null,
      output: ''
    },
    {
      input: undefined,
      output: ''
    },
    {
      input: NaN,
      output: ''
    }
  ]

  for (const [, fixture] of fixtures.entries()) {
    const result = grabLastUrlSegment(fixture.input)
    t.equals(
      result, fixture.output, `expecting ${result} to equal ${fixture.output}`
    )
  }
  t.end()
})
