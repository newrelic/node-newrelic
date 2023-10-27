/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Head from 'next/head'

export async function getProps() {
  return {
    title: 'This is a standard statically built page.'
  }
}


export default async function Standard() {
  const { title } = await getProps()
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <h1>{title}</h1>
    </>
  )
}
