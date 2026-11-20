/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// regionRegex for every non-commercial AWS partition, copied verbatim from
// https://github.com/aws/aws-sdk-js-v3/blob/main/packages-internal/util-endpoints/src/lib/aws/partitions.json
const PARTITIONS = require('./aws-partitions.json').map(({ id, regionRegex }) => {
  return {
    id,
    regex: new RegExp(regionRegex)
  }
})

const DEFAULT_PARTITION = 'aws'

/**
 * Derives the AWS partition (the second segment of an ARN) from a region.
 * For example, `us-gov-west-1` is in the `aws-us-gov` partition.
 *
 * @param {string} region The AWS region the resource lives in.
 * @returns {string} The partition for the region, or `aws` when the region is missing or unrecognized.
 */
function getAwsPartition(region) {
  if (typeof region !== 'string') {
    return DEFAULT_PARTITION
  }

  const match = PARTITIONS.find(({ regex }) => regex.test(region))
  return match ? match.id : DEFAULT_PARTITION
}

module.exports = getAwsPartition
