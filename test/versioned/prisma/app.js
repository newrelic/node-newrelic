/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
async function upsertUsers(prisma) {
  prisma.$use(async function prismaMiddleware(params, next) {
    if (params.action === 'update') {
      params.args.data.updatedBy = 'Jessica Lopatta <jlopatta@newrelic.com>'
    }

    return next(params)
  })

  const users = await prisma.user.findMany()

  const upserts = []

  users.forEach((user) => {
    const name = user.name.split('-')[0]
    upserts.push(
      prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          name: `${name}-Updated`
        }
      })
    )
  })

  await Promise.all(upserts)

  return await prisma.user.findMany({ orderBy: { name: 'asc' } })
}

module.exports = { upsertUsers }
