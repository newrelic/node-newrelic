/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { register } from 'node:module'

register('./esm-rewriter.mjs', import.meta.url)
register('import-in-the-middle/hook.mjs', import.meta.url, {
  // Exclusions must be regexes
  data: { exclude: [/@openai\/agents.*/] }
})
