/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Use `import.meta.resolve` and a dynamic `import()` so the loader's
// `initializeImportMeta` resolver and `importModuleDynamically` callbacks run.
const resolved = import.meta.resolve('./limits.mjs')
const { valueSizeLimit } = await import('./limits.mjs')

export const config = {
  high_security: typeof resolved !== 'string',

  attributes: {
    enabled: true,
    value_size_limit: valueSizeLimit
  }
}
