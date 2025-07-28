/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { register } from 'node:module'
// Exclusions must be regexes
const exclusions = [/@openai\/agents.*/]

register('./esm-rewriter.mjs', import.meta.url)
register('import-in-the-middle/hook.mjs', import.meta.url, {
  data: { exclude: exclusions }
})
