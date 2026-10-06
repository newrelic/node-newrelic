/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Import the same module via two different specifier spellings. The VM linker
// deduplicates on the raw specifier string, so both reach the loader's linker,
// and the second resolves to a URL already in the link cache.
import { valueSizeLimit } from './limits.mjs'
import { valueSizeLimit as sameLimit } from './x/../limits.mjs'

export const config = {
  high_security: false,

  attributes: {
    enabled: true,
    value_size_limit: valueSizeLimit === sameLimit ? valueSizeLimit : 0
  }
}
