#! /bin/sh

# Copyright 2026 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

# Start docker-compose services and wait on their healthchecks.
#
# With no arguments, ALL services are started -- this is the default used by
# `npm run services` for local development. When one or more service names are
# passed, only those services are started; CI uses this to start just the
# services a given versioned-test shard needs.

export DOCKER_PLATFORM="linux/$(uname -m)"
docker compose up -d --wait "$@"
