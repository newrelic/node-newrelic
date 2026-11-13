/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { extractAttributeValue } = require('#agentlib/otel/traces/utils.js')
const dynamo140 = require('#agentlib/otel/traces/transformation-rules/308-OtelDbClientDynamo1_40.json')
const dynamo117 = require('#agentlib/otel/traces/transformation-rules/309-OtelDbClientDynamo1_17.json')
const lambda117 = require('#agentlib/otel/traces/transformation-rules/315-OtelLambdaClient1_17.json')

const ACCOUNT_ID = '123456789012'

function resourceIdAttribute(rule) {
  return rule.attributes.find((attribute) => attribute.name === 'cloud.resource_id')
}

function getResourceId(rule, attributes) {
  return extractAttributeValue({
    accountId: ACCOUNT_ID,
    attribute: resourceIdAttribute(rule),
    excludeAttributes: new Set(),
    span: { attributes }
  })
}

for (const rule of [dynamo140, dynamo117]) {
  test(`${rule.name} cloud.resource_id`, async (t) => {
    await t.test('uses the aws partition in commercial regions', () => {
      const resourceId = getResourceId(rule, {
        'aws.region': 'us-east-1',
        'aws.dynamodb.table_names': ['test-table']
      })
      assert.equal(resourceId, `arn:aws:dynamodb:us-east-1:${ACCOUNT_ID}:table/test-table`)
    })

    await t.test('uses the aws-us-gov partition in GovCloud', () => {
      const resourceId = getResourceId(rule, {
        'aws.region': 'us-gov-west-1',
        'aws.dynamodb.table_names': ['test-table']
      })
      assert.equal(resourceId, `arn:aws-us-gov:dynamodb:us-gov-west-1:${ACCOUNT_ID}:table/test-table`)
    })

    await t.test('uses the aws-cn partition in China', () => {
      const resourceId = getResourceId(rule, {
        'aws.region': 'cn-north-1',
        'aws.dynamodb.table_names': ['test-table']
      })
      assert.equal(resourceId, `arn:aws-cn:dynamodb:cn-north-1:${ACCOUNT_ID}:table/test-table`)
    })
  })
}

test('OtelLambdaClient1_17 cloud.resource_id', async (t) => {
  await t.test('uses the aws partition in commercial regions', () => {
    const resourceId = getResourceId(lambda117, {
      'aws.region': 'us-east-1',
      'faas.invoked_name': 'test-function',
      'faas.invoked_region': 'us-east-1'
    })
    assert.equal(resourceId, `arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:test-function`)
  })

  await t.test('uses the aws-us-gov partition in GovCloud', () => {
    const resourceId = getResourceId(lambda117, {
      'aws.region': 'us-gov-west-1',
      'faas.invoked_name': 'test-function',
      'faas.invoked_region': 'us-gov-west-1'
    })
    assert.equal(resourceId, `arn:aws-us-gov:lambda:us-gov-west-1:${ACCOUNT_ID}:function:test-function`)
  })

  await t.test('prefers aws.region over faas.invoked_region', () => {
    const resourceId = getResourceId(lambda117, {
      'aws.region': 'us-gov-west-1',
      'faas.invoked_name': 'test-function',
      'faas.invoked_region': 'us-east-1'
    })
    assert.equal(resourceId, `arn:aws-us-gov:lambda:us-gov-west-1:${ACCOUNT_ID}:function:test-function`)
  })

  await t.test('falls back to faas.invoked_region when aws.region is not present', () => {
    const resourceId = getResourceId(lambda117, {
      'faas.invoked_name': 'test-function',
      'faas.invoked_region': 'cn-north-1'
    })
    assert.equal(resourceId, `arn:aws-cn:lambda:cn-north-1:${ACCOUNT_ID}:function:test-function`)
  })

  await t.test('uses a full ARN in faas.invoked_name unchanged', () => {
    const functionArn = 'arn:aws-us-gov:lambda:us-gov-west-1:111111111111:function:test-function'
    const resourceId = getResourceId(lambda117, {
      'aws.region': 'us-gov-west-1',
      'faas.invoked_name': functionArn,
      'faas.invoked_region': 'us-gov-west-1'
    })
    assert.equal(resourceId, functionArn)
  })
})
