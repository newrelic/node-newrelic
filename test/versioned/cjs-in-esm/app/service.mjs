/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default {
  doTest: async () => {
    await sleep(Math.floor(Math.random() * 1000))
  }
}
