/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Transport from 'winston-transport'
export class Sink extends Transport {
  loggedLines = []
  log(data, done) {
    this.loggedLines.push(data)
    done()
  }
}
