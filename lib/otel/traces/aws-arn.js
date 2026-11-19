/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const getAwsPartition = require('#agentlib/util/aws-partition.js')

const PLACEHOLDER = /\${(.*?)}/g

/**
 * The `arn` definition on a transformation rule attribute.
 *
 * @typedef {object} AwsArnDefinition
 * @property {string} service The AWS service segment of the ARN, e.g. `lambda`.
 * @property {string} regionKey The span attribute holding the resource's region.
 * @property {string} resource A template for the resource segment of the ARN, filled from span attributes.
 * @property {string} [arnKey] A span attribute that may already hold the full ARN.
 */

/**
 * Builds an AWS ARN for a span from a transformation rule's `arn` definition.
 *
 * The partition is derived from the region, so non-commercial partitions
 * (e.g. `aws-us-gov` in GovCloud) get correct ARNs. If the span attribute
 * named by `arnKey` already holds a full ARN, it is returned unchanged.
 *
 * @param {object} params The parameters for building the ARN.
 * @param {string} params.accountId The value of agent.config.cloud.aws.account_id.
 * @param {AwsArnDefinition} params.arn The rule's ARN definition.
 * @param {object} params.span The span to read attributes from.
 * @returns {string|undefined} The ARN, or undefined when any part of it is missing.
 */
function buildAwsArn({ accountId, arn, span }) {
  const { arnKey, regionKey, resource, service } = arn
  const attributes = span?.attributes ?? {}

  const fullArn = attributes[arnKey]
  if (typeof fullArn === 'string' && fullArn.startsWith('arn:')) {
    return fullArn
  }

  const region = attributes[regionKey]
  if (!accountId || !region) {
    return
  }

  let missingValue = false
  const resourceId = resource.replace(PLACEHOLDER, (_, key) => {
    const value = attributes[key]
    if (value === undefined || value === null || value === '') {
      missingValue = true
    }
    return value
  })
  if (missingValue) {
    return
  }

  return `arn:${getAwsPartition(region)}:${service}:${region}:${accountId}:${resourceId}`
}

module.exports = buildAwsArn
