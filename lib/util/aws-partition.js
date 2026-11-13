/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Region prefixes for every non-commercial AWS partition. Keep in sync with
// https://github.com/aws/aws-sdk-js-v3/blob/main/packages-internal/util-endpoints/src/lib/aws/partitions.json
const PARTITIONS = [
  ['cn-', 'aws-cn'],
  ['us-gov-', 'aws-us-gov'],
  ['us-iso-', 'aws-iso'],
  ['us-isob-', 'aws-iso-b'],
  ['eu-isoe-', 'aws-iso-e'],
  ['us-isof-', 'aws-iso-f'],
  ['eusc-', 'aws-eusc']
]

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

  for (const [prefix, partition] of PARTITIONS) {
    if (region.startsWith(prefix)) {
      return partition
    }
  }

  return DEFAULT_PARTITION
}

module.exports = getAwsPartition
