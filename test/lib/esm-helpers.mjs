/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as url from 'url'
import semver from 'semver'
const helpers = Object.create(null)

helpers.__dirname = function __dirname(cwd) {
  return url.fileURLToPath(new URL('.', cwd))
}

helpers.supportedLoaderVersion = function supportedLoaderVersion() {
  return semver.gte(process.version, 'v16.12.0')
}

export default helpers
