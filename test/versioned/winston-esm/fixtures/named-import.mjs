/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import winston from 'winston'

export function doLog(sink) {
  const logger = winston.createLogger({
    transports: sink
  })
  logger.warn('import winston from winston')
}
