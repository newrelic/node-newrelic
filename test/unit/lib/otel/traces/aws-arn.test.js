/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const buildAwsArn = require('#agentlib/otel/traces/aws-arn.js')

/* eslint-disable no-template-curly-in-string -- resource templates use ${} placeholders */
const ACCOUNT_ID = '123456789012'
const ARN = {
  service: 'lambda',
  regionKey: 'faas.invoked_region',
  resource: 'function:${faas.invoked_name}',
  arnKey: 'faas.invoked_name'
}

test('builds the ARN with the partition derived from the region', () => {
  const arn = buildAwsArn({
    accountId: ACCOUNT_ID,
    arn: ARN,
    span: { attributes: { 'faas.invoked_region': 'us-gov-west-1', 'faas.invoked_name': 'test-function' } }
  })
  assert.equal(arn, `arn:aws-us-gov:lambda:us-gov-west-1:${ACCOUNT_ID}:function:test-function`)
})

test('fills every placeholder in the resource template', () => {
  const arn = buildAwsArn({
    accountId: ACCOUNT_ID,
    arn: { service: 'kinesis', regionKey: 'aws.region', resource: '${type}/${name}' },
    span: { attributes: { 'aws.region': 'us-east-1', type: 'stream', name: 'my-stream' } }
  })
  assert.equal(arn, `arn:aws:kinesis:us-east-1:${ACCOUNT_ID}:stream/my-stream`)
})

test('returns the arnKey attribute unchanged when it is already a full ARN', () => {
  const functionArn = 'arn:aws-cn:lambda:cn-north-1:111111111111:function:test-function'
  const arn = buildAwsArn({
    accountId: undefined,
    arn: ARN,
    span: { attributes: { 'faas.invoked_name': functionArn } }
  })
  assert.equal(arn, functionArn)
})

test('ignores an arnKey attribute that is not a full ARN', () => {
  const arn = buildAwsArn({
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
      assert.equal(buildAwsArn({ accountId, arn: ARN, span: { attributes: spanAttributes } }), undefined)
    })
  }
})
