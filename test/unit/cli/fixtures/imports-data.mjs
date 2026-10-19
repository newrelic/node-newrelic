/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { valueSizeLimit } from './limits.mjs'

export const config = {
  app_name: ['My Application'],
  license_key: 'license key here',
  high_security: false,

  attributes: {
    enabled: true,
    value_size_limit: valueSizeLimit
  }
}
