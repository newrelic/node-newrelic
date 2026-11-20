/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { buildAwsArn } = require('#agentlib/util/aws-arn.js')

/**
 * The `arn` definition on a transformation rule attribute.
 *
 * @typedef {object} AwsArnDefinition
 * @property {string} service The AWS service segment of the ARN, e.g. `lambda`.
 * @property {string} regionKey The span attribute holding the resource's region.
 * @property {string} resourcePrefix A static prefix for the resource segment, e.g. `function:` or `table/`.
 * @property {string} resourceKey The span attribute holding the resource identifier. May already hold a full ARN.
 */

/**
 * Builds an AWS ARN for a span from a transformation rule's `arn` definition.
 *
 * @param {object} params The parameters for building the ARN.
 * @param {string} params.accountId The value of agent.config.cloud.aws.account_id.
 * @param {AwsArnDefinition} params.arn The rule's ARN definition.
 * @param {object} params.span The span to read attributes from.
 * @returns {string|undefined} The ARN, or undefined when any part of it is missing.
 */
function buildOtelAwsArn({ accountId, arn, span }) {
  const { regionKey, resourceKey, resourcePrefix, service } = arn
  const attributes = span?.attributes ?? {}

  return buildAwsArn({
    accountId,
    service,
    region: attributes[regionKey],
    resourcePrefix,
    resource: attributes[resourceKey]
  })
}

module.exports = buildOtelAwsArn
