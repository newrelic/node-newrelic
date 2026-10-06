/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EOL } from 'node:os'

// Reference `import.meta` so the loader's import.meta initialization runs, and
// use a `node:` builtin import so that specifier resolution path is exercised.
export const config = {
  high_security: typeof EOL === 'string' && import.meta.url !== undefined
    ? false
    : true
}
