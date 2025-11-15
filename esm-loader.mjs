/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { register } from 'node:module'
import subscriptions from './lib/subscriber-configs.js'
import createSubscriberConfigs from './lib/subscribers/create-config.js'
// Exclusions must be regexes
const exclusions = [/@openai\/agents.*/]
const { instrumentations } = createSubscriberConfigs(subscriptions)

register('@apm-js-collab/tracing-hooks/hook.mjs', import.meta.url, {
  data: { instrumentations }
})
register('import-in-the-middle/hook.mjs', import.meta.url, {
  data: { exclude: exclusions }
})
