/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')
const HttpHandler = require('#agentlib/subscribers/azure-functions/http-handler.js')
const BackgroundHandler = require('#agentlib/subscribers/azure-functions/background-handler.js')

module.exports = class AzureFunctionsSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_generic', packageName: '@azure/functions' })
    this.requireActiveTx = false
    this.coldStart = true
  }

  handler(data, ctx) {
    if (this.missingEnvVars) {
      this.logger.warn(
        {
          data: {
            expectedVars: ['WEBSITE_OWNER_NAME', 'WEBSITE_RESOURCE_GROUP', 'WEBSITE_SITE_NAME'],
            found: { WEBSITE_OWNER_NAME: this.subscriptionId, WEBSITE_RESOURCE_GROUP: this.resourceGroup, WEBSITE_SITE_NAME: this.azureFunctionAppName }
          }
        },
        'could not initialize azure functions instrumentation due to missing environment variables'
      )
      return ctx
    }

    const { arguments: args } = data
    const [, options] = args
    const self = this
    const originalHandler = options.handler

    args[1].handler = async function wrappedHandler(...handlerArgs) {
      let handler
      if (options?.return?.type === 'http') {
        handler = new HttpHandler({ subscriber: self })
      } else {
        handler = new BackgroundHandler({ subscriber: self })
      }
      return handler.handle({ thisArg: this, originalHandler, handlerArgs })
    }
  }

  get missingEnvVars() {
    return !this.subscriptionId || !this.resourceGroup || !this.azureFunctionAppName
  }

  get subscriptionId() {
    if (!process.env.WEBSITE_OWNER_NAME) {
      return null
    }

    return process.env.WEBSITE_OWNER_NAME?.split('+').shift()
  }

  get resourceGroup() {
    const { WEBSITE_RESOURCE_GROUP, WEBSITE_OWNER_NAME } = process.env
    if (!WEBSITE_RESOURCE_GROUP && WEBSITE_OWNER_NAME) {
      return WEBSITE_OWNER_NAME.split('+').pop().split('-Linux').shift()
    }

    return WEBSITE_RESOURCE_GROUP
  }

  get azureFunctionAppName() {
    const { WEBSITE_SITE_NAME } = process.env
    return WEBSITE_SITE_NAME
  }
}
