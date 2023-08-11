/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import service from './service.mjs'

export default {
  doTest: async (req, res, next) => {
    try {
      await service.doTest()
      return res.send('Hello World!')
    } catch (err) {
      return next(err)
    }
  }
}
