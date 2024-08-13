/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const selfCert = require('self-cert')
module.exports = selfCert({
  attrs: {
    stateName: 'Georgia',
    locality: 'Atlanta',
    orgName: 'New Relic',
    shortName: 'new_relic'
  },
  expires: new Date('2099-12-31')
})
