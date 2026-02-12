/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = attachAttributes

const { isSimpleObject } = require('#agentlib/util/objects.js')

/**
 * Applies common attributes to the various LangChain object types. We can't
 * inline this to a common base class, because they all need to inherit from
 * disparate base classes.
 *
 * @param {object} params Function parameters
 * @param {object} params.target The LLM event object to decorate.
 * @param {object} [params.agent] The agent instance.
 * @param {object} [params.metadata] A set of key-value pairs to attach.
 * @param {string|string[]} [params.tags] A comma separated list of tags, or an
 * array of string tags.
 */
function attachAttributes({ target, agent = null, metadata = null, tags = null }) {
  if (agent) {
    target.appName = agent.config.applications()[0]
  }

  if (isSimpleObject(metadata) === true) {
    target.langchainMeta = metadata
    for (const [k, v] of Object.entries(metadata)) {
      target[`metadata.${k}`] = v
    }
  }

  if (Array.isArray(tags) === true) {
    target.tags = tags.join(',')
  } else if (typeof tags === 'string') {
    target.tags = tags
  }
}
