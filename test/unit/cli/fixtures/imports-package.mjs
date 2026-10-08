/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import semver from 'semver'

// Import a bare specifier (an installed package) so the loader resolves it via
// the Node.js module resolution algorithm anchored at this file's location.
export const config = {
  high_security: semver.valid('1.0.0') === null
}
