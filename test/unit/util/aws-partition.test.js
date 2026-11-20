/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const getAwsPartition = require('#agentlib/util/aws-partition.js')
const partitions = require('#agentlib/util/aws-partitions.json')

test('aws-partitions.json has a compilable regionRegex for every non-default partition', () => {
  assert.ok(partitions.length > 0)
  for (const { id, regionRegex } of partitions) {
    assert.equal(typeof id, 'string')
    assert.notEqual(id, 'aws', 'the default partition is the fallback, not an entry')
    assert.doesNotThrow(() => new RegExp(regionRegex), `${id} regionRegex should compile`)
  }
})

test('derives the partition for every AWS partition', async (t) => {
  const cases = [
    ['us-east-1', 'aws'],
    ['eu-west-1', 'aws'],
    ['ap-southeast-2', 'aws'],
    ['cn-north-1', 'aws-cn'],
    ['cn-northwest-1', 'aws-cn'],
    ['us-gov-west-1', 'aws-us-gov'],
    ['us-gov-east-1', 'aws-us-gov'],
    ['us-iso-east-1', 'aws-iso'],
    ['us-isob-east-1', 'aws-iso-b'],
    ['eu-isoe-west-1', 'aws-iso-e'],
    ['us-isof-south-1', 'aws-iso-f'],
    ['eusc-de-east-1', 'aws-eusc']
  ]

  for (const [region, expected] of cases) {
    await t.test(region, () => {
      assert.equal(getAwsPartition(region), expected)
    })
  }
})

test('falls back to aws when the region is missing or unrecognized', async (t) => {
  const cases = [
    undefined,
    null,
    '',
    123,
    {},
    'my-emulator:4566',
    'US-GOV-WEST-1',
    // Region-shaped values that don't match a partition's full regionRegex
    'us-gov-west',
    'cn-north-1a',
    'eusc-east-1',
    'xus-gov-west-1'
  ]

  for (const region of cases) {
    await t.test(String(region), () => {
      assert.equal(getAwsPartition(region), 'aws')
    })
  }
})
