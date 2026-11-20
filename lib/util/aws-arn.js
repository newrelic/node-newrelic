/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const getAwsPartition = require('./aws-partition.js')

/**
 * Checks whether a value is already a full ARN.
 *
 * @param {unknown} value The value to check.
 * @returns {boolean} True when the value is a string that starts with `arn:`.
 */
function isFullArn(value) {
  return typeof value === 'string' && value.startsWith('arn:')
}

/**
 * Builds an AWS ARN, or returns `resource` unchanged when it is already a full ARN.
 *
 * The partition is derived from the region, so non-commercial partitions
 * (e.g. `aws-us-gov` in GovCloud) get correct ARNs.
 *
 * @param {object} params The parameters for building the ARN.
 * @param {string} params.accountId The value of agent.config.cloud.aws.account_id.
 * @param {string} params.service The AWS service segment of the ARN, e.g. `lambda`.
 * @param {string} params.region The AWS region of the resource.
 * @param {string} params.resourcePrefix A static prefix for the resource segment, e.g. `function:` or `table/`.
 * @param {string} params.resource The resource identifier, e.g. FunctionName or TableName. May already be a full ARN.
 * @returns {string|undefined} The ARN, or undefined when accountId, region, or resource is missing.
 */
function buildAwsArn({ accountId, service, region, resourcePrefix = '', resource }) {
  if (isFullArn(resource)) {
    return resource
  }

  if (!accountId || !region || !resource) {
    return
  }

  return `arn:${getAwsPartition(region)}:${service}:${region}:${accountId}:${resourcePrefix}${resource}`
}

module.exports = { buildAwsArn, isFullArn }
