/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { buildAwsArn, isFullArn } = require('#agentlib/util/aws-arn.js')

const ACCOUNT_ID = '123456789012'

test('builds the ARN with the partition derived from the region', () => {
  const arn = buildAwsArn({
    accountId: ACCOUNT_ID,
    service: 'lambda',
    region: 'us-gov-west-1',
    resourcePrefix: 'function:',
    resource: 'test-function'
  })
  assert.equal(arn, `arn:aws-us-gov:lambda:us-gov-west-1:${ACCOUNT_ID}:function:test-function`)
})

test('defaults to the aws partition for a commercial region', () => {
  const arn = buildAwsArn({
    accountId: ACCOUNT_ID,
    service: 'dynamodb',
    region: 'us-east-1',
    resourcePrefix: 'table/',
    resource: 'my-table'
  })
  assert.equal(arn, `arn:aws:dynamodb:us-east-1:${ACCOUNT_ID}:table/my-table`)
})

test('builds the ARN with no resourcePrefix', () => {
  const arn = buildAwsArn({
    accountId: ACCOUNT_ID,
    service: 'lambda',
    region: 'us-east-1',
    resource: 'function:test-function'
  })
  assert.equal(arn, `arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:test-function`)
})

test('returns resource unchanged when it is already a full ARN', () => {
  const functionArn = 'arn:aws-cn:lambda:cn-north-1:111111111111:function:test-function'
  const arn = buildAwsArn({
    accountId: undefined,
    service: 'lambda',
    region: undefined,
    resourcePrefix: 'function:',
    resource: functionArn
  })
  assert.equal(arn, functionArn)
})

test('returns undefined when accountId or region is missing', async (t) => {
  const cases = [
    ['account id', { accountId: undefined, region: 'us-east-1' }],
    ['account id is null', { accountId: null, region: 'us-east-1' }],
    ['region', { accountId: ACCOUNT_ID, region: undefined }],
    ['region is empty', { accountId: ACCOUNT_ID, region: '' }]
  ]

  for (const [missing, { accountId, region }] of cases) {
    await t.test(missing, () => {
      assert.equal(
        buildAwsArn({ accountId, service: 'lambda', region, resourcePrefix: 'function:', resource: 'test-function' }),
        undefined
      )
    })
  }
})

test('isFullArn', async (t) => {
  const cases = [
    ['arn:aws:lambda:us-east-1:123456789012:function:my-fn', true],
    ['arn:aws-us-gov:dynamodb:us-gov-west-1:123456789012:table/my-table', true],
    ['my-fn', false],
    ['', false],
    [undefined, false],
    [null, false],
    [123, false]
  ]

  for (const [value, expected] of cases) {
    await t.test(String(value), () => {
      assert.equal(isFullArn(value), expected)
    })
  }
})
