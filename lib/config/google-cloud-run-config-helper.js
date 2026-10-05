/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({
  component: 'google-cloud-run-config-helper'
})

class GoogleCloudRunConfigHelper {
  #config
  #logger

  constructor({ agentConfig, logger = defaultLogger } = {}) {
    this.#config = agentConfig
    this.#logger = logger
  }

  /**
   * Determines the Google Cloud Run host name from the instance id. When
   * `utilization.gcp_cloud_run.include_revision_in_host` is enabled and
   * an instance-identifying env var (`K_REVISION`, `CLOUD_RUN_REVISION`, or
   * `CLOUD_RUN_EXECUTION`) is present, the revision is prepended to the
   * instance id, resulting in a host name of `${revision}-${gcpId}`.
   *
   * @param {string} gcpId GCP metadata ID
   *
   *  @returns {string} host name
   */
  getGcrHostname(gcpId) {
    const gcrEnvVar =
      process.env.K_REVISION ??
      process.env.CLOUD_RUN_REVISION ??
      process.env.CLOUD_RUN_EXECUTION

    if (
      gcrEnvVar &&
      this.#config.utilization.gcp_cloud_run.include_revision_in_host
    ) {
      const hostname = `${gcrEnvVar}-${gcpId}`
      this.#logger.info(
        'Using identifying Google Cloud Run env var and GCP instance ID for host name: %s',
        hostname
      )
      return hostname
    }

    this.#logger.info('Using GCP instance ID for host name: %s', gcpId)
    return gcpId
  }

  /**
   * Identifies if `use_instance_as_host` is enabled and if the process
   * is in a Google Cloud Run (GCR) environment.
   *
   * @param {string} gcpId GCP metadata ID.
   *
   * @returns {boolean} True if `use_instance_as_host` is set to true and
   * if a GCR-identifying environment variable and metadata ID are present.
   */
  shouldUseGcrHostname(gcpId) {
    // TODO: `gcp_use_instance_as_host` is deprecated (will be removed
    // in v15 of the agent) in favor of `gcp_cloud_run.use_instance_as_host`.
    const useInstanceAsHost =
      this.#config.utilization.gcp_cloud_run.use_instance_as_host ||
      this.#config.utilization.gcp_use_instance_as_host
    const isCloudRun = process.env.K_SERVICE ||
      process.env.CLOUD_RUN_JOB ||
      process.env.CLOUD_RUN_WORKER_POOL
    return Boolean(useInstanceAsHost && isCloudRun && gcpId)
  }
}

module.exports = GoogleCloudRunConfigHelper
