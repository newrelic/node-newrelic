/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const buildOtelAwsArn = require('#agentlib/otel/traces/aws-arn.js')

const ACCOUNT_ID = '123456789012'
const ARN = {
  service: 'lambda',
  regionKey: 'faas.invoked_region',
  resourcePrefix: 'function:',
  resourceKey: 'faas.invoked_name'
}

test('builds the ARN with the partition derived from the region', () => {
  const arn = buildOtelAwsArn({
    accountId: ACCOUNT_ID,
    arn: ARN,
    span: { attributes: { 'faas.invoked_region': 'us-gov-west-1', 'faas.invoked_name': 'test-function' } }
  })
  assert.equal(arn, `arn:aws-us-gov:lambda:us-gov-west-1:${ACCOUNT_ID}:function:test-function`)
})

test('builds the ARN with no resourcePrefix', () => {
  const arn = buildOtelAwsArn({
    accountId: ACCOUNT_ID,
    arn: { service: 'kinesis', regionKey: 'aws.region', resourceKey: 'name' },
    span: { attributes: { 'aws.region': 'us-east-1', name: 'stream/my-stream' } }
  })
  assert.equal(arn, `arn:aws:kinesis:us-east-1:${ACCOUNT_ID}:stream/my-stream`)
})

test('returns the resourceKey attribute unchanged when it is already a full ARN', () => {
  const functionArn = 'arn:aws-cn:lambda:cn-north-1:111111111111:function:test-function'
  const arn = buildOtelAwsArn({
    accountId: undefined,
    arn: ARN,
    span: { attributes: { 'faas.invoked_name': functionArn } }
  })
  assert.equal(arn, functionArn)
})

test('ignores a resourceKey attribute that is not a full ARN', () => {
  const arn = buildOtelAwsArn({
    accountId: ACCOUNT_ID,
    arn: ARN,
    span: { attributes: { 'faas.invoked_region': 'us-east-1', 'faas.invoked_name': 'function:test-function' } }
  })
  assert.equal(arn, `arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:function:test-function`)
})

test('returns undefined when any part of the ARN is missing', async (t) => {
  const attributes = { 'faas.invoked_region': 'us-east-1', 'faas.invoked_name': 'test-function' }
  const cases = [
    ['account id', { accountId: undefined, attributes }],
    ['account id is null', { accountId: null, attributes }],
    ['region', { accountId: ACCOUNT_ID, attributes: { 'faas.invoked_name': 'test-function' } }],
    ['region is empty', { accountId: ACCOUNT_ID, attributes: { ...attributes, 'faas.invoked_region': '' } }],
    ['resource value', { accountId: ACCOUNT_ID, attributes: { 'faas.invoked_region': 'us-east-1' } }],
    ['resource value is empty', { accountId: ACCOUNT_ID, attributes: { ...attributes, 'faas.invoked_name': '' } }],
    ['span attributes', { accountId: ACCOUNT_ID, attributes: undefined }]
  ]

  for (const [missing, { accountId, attributes: spanAttributes }] of cases) {
    await t.test(missing, () => {
      assert.equal(buildOtelAwsArn({ accountId, arn: ARN, span: { attributes: spanAttributes } }), undefined)
    })
  }
})
