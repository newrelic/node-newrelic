/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Base class for AWS Bedrock command wrappers (`InvokeModelCommand`, `ConverseCommand`).
 */
class ModelCommand {
  static MODEL_TYPE_EMBEDDING = 'embedding'
  static MODEL_TYPE_COMPLETION = 'completion'

  #modelId

  /**
   * @param {object} input The `input` property from the underlying AWS SDK command instance.
   */
  constructor(input) {
    this.#modelId = input.modelId?.toLowerCase() ?? ''
  }

  /**
   * The model identifier for the command.
   *
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   *
   * @returns {string}
   */
  get modelId() {
    return this.#modelId
  }

  /**
   * @returns {string} `ModelCommand.MODEL_TYPE_EMBEDDING` or `ModelCommand.MODEL_TYPE_COMPLETION`
   */
  get modelType() {
    return this.modelId.includes('embed')
      ? ModelCommand.MODEL_TYPE_EMBEDDING
      : ModelCommand.MODEL_TYPE_COMPLETION
  }
}

module.exports = ModelCommand
