/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'utilization.js',
  type: 'object',
  properties: {
    detect_aws: {
      type: 'boolean',
      default: true,
      description: 'This flag dictates whether the agent attempts to reach out to AWS to get info about the vm the process is running on.'
    },
    detect_pcf: {
      type: 'boolean',
      default: true,
      description: 'This flag dictates whether the agent attempts to detect if the the process is running on Pivotal Cloud Foundry.'
    },
    detect_azure: {
      type: 'boolean',
      default: true,
      description: 'This flag dictates whether the agent attempts to reach out to Azure to get info about the vm the process is running on.'
    },
    detect_azurefunction: {
      type: 'boolean',
      default: true,
      description: 'This flag dictates whether the agent attempts to read environment variables and invocation context to get info about the Azure Function called.'
    },
    detect_docker: {
      type: 'boolean',
      default: true,
      description: 'This flag dictates whether the agent attempts to read files to get info about the container the process is running in. env NEW_RELIC_UTILIZATION_DETECT_DOCKER'
    },
    detect_gcp: {
      type: 'boolean',
      default: true,
      description: 'This flag dictates whether the agent attempts to reach out to GCP to get info about the vm the process is running on.'
    },
    detect_kubernetes: {
      type: 'boolean',
      default: true,
      description: 'This flag dictates whether the agent attempts to reach out to Kubernetes to get info about the container the process is running on.'
    },
    logical_processors: {
      type: 'number',
      default: null
    },
    billing_hostname: {
      type: [
        'string',
        'null'
      ],
      default: null
    },
    total_ram_mib: {
      type: 'integer',
      default: null
    },
    gcp_use_instance_as_host: {
      type: 'boolean',
      default: true,
      description: 'Deprecated and will be removed in v15 of the agent. Please use `utilization.gcp_cloud_run.use_instance_as_host` instead. When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs).'
    },
    gcp_cloud_run: {
      type: 'object',
      properties: {
        include_revision_in_host: {
          type: 'boolean',
          default: false,
          description: 'If `true`, the agent prepends the Cloud Run revision name to the GCP instance id to form the hostname (`{revision}-{instance id}`) on Google Cloud Run. The revision name comes from `K_REVISION` on a Cloud Run Service, `CLOUD_RUN_REVISION` on a Cloud Run Worker Pool, and `CLOUD_RUN_EXECUTION` on a Cloud Run Job. Has no effect unless `utilization.gcp_use_instance_as_host` is also `true`.'
        },
        use_instance_as_host: {
          type: 'boolean',
          default: true,
          description: 'When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs).'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Options regarding collecting system information. Used for system utilization based pricing scheme.'
}
