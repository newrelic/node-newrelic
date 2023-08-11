/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export default async function generateApp() {
  const { default: express } = await import('express')
  // eslint-disable-next-line no-unused-vars
  const { default: swaggerUi } = await import('swagger-ui-express')
  const { default: Routes } = await import('./app/routes.mjs')

  const app = express()
  app.use('/weird', Routes)

  return app
}
