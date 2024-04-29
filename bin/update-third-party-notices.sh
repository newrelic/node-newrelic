#!/usr/bin/env bash
#
# Checks all staged files for
# package.json. If it changes
# it will re-run `oss third-party manifest`
# and `oss third-party notices` to keep
# these files up to date as deps get updated

STAGED_FILES=$(git diff-index --cached --name-only HEAD)

PKG_HAS_CHANGED=0
for FILE in $STAGED_FILES
do
  if [ ${FILE} == "package.json" ]; then
    PKG_HAS_CHANGED=1
    break
  fi
done

if [ ${PKG_HAS_CHANGED} -eq 0 ]; then
  echo "package.json has not changed"
  exit 0
fi

if ! [ -x "$(command -v jq)" ]; then
  echo "Please install jq."
  echo "https://jqlang.github.io/jq/"
  exit 1
fi

MAIN_PKG=$(git show main:package.json | jq -rc)
HEAD_PKG=$(git cat-file blob :package.json | jq -rc)

MAIN_DEPS_LEN=$(echo "${MAIN_PKG}" | jq '.dependencies | length')
HEAD_DEPS_LEN=$(echo "${HEAD_PKG}" | jq '.dependencies | length')
MAIN_OPT_DEPS_LEN=$(echo "${MAIN_PKG}" | jq '.optionalDependencies | length')
HEAD_OPT_DEPS_LEN=$(echo "${HEAD_PKG}" | jq '.optionalDependencies | length')
MAIN_DEV_DEPS_LEN=$(echo "${MAIN_PKG}" | jq '.devDependencies | length')
HEAD_DEV_DEPS_LEN=$(echo "${HEAD_PKG}" | jq '.devDependencies | length')

RUN_THIRD_PARTY=0
if [ ${MAIN_DEPS_LEN} -ne ${HEAD_DEPS_LEN} ]; then
  RUN_THIRD_PARTY=1
elif [ ${MAIN_OPT_DEPS_LEN} -ne ${HEAD_OPT_DEPS_LEN} ]; then
  RUN_THIRD_PARTY=1
elif [ ${MAIN_DEV_DEPS_LEN} -ne ${HEAD_DEV_DEPS_LEN} ]; then
  RUN_THIRD_PARTY=1
fi

if [ ${RUN_THIRD_PARTY} -eq 0 ]; then
  for dep in $(echo "${MAIN_PKG}" | jq -rc '.dependencies | to_entries | .[]'); do
    NAME=$(echo ${dep} | jq -r '.key')
    VERSION=$(echo ${dep} | jq -r '.value')
    HEAD_VERSION=$(echo "${HEAD_PKG}" | jq -rc --arg pkg "${NAME}" '.dependencies[$pkg]')
    if [ "${VERSION}" != "${HEAD_VERSION}" ]; then
      RUN_THIRD_PARTY=1
      break
    fi
  done
fi

if [ ${RUN_THIRD_PARTY} -eq 0 ]; then
  for dep in $(echo "${MAIN_PKG}" | jq -rc '.optionalDependencies | to_entries | .[]'); do
    NAME=$(echo ${dep} | jq -r '.key')
    VERSION=$(echo ${dep} | jq -r '.value')
    HEAD_VERSION=$(echo "${HEAD_PKG}" | jq -rc --arg pkg "${NAME}" '.optionalDependencies[$pkg]')
    if [ "${VERSION}" != "${HEAD_VERSION}" ]; then
      RUN_THIRD_PARTY=1
      break
    fi
  done
fi

if [ ${RUN_THIRD_PARTY} -eq 0 ]; then
  for dep in $(echo "${MAIN_PKG}" | jq -rc '.devDependencies | to_entries | .[]'); do
    NAME=$(echo ${dep} | jq -r '.key')
    VERSION=$(echo ${dep} | jq -r '.value')
    HEAD_VERSION=$(echo "${HEAD_PKG}" | jq -rc --arg pkg "${NAME}" '.devDependencies[$pkg]')
    if [ "${VERSION}" != "${HEAD_VERSION}" ]; then
      RUN_THIRD_PARTY=1
      break
    fi
  done
fi

if [ ${RUN_THIRD_PARTY} -eq 1 ]; then
  echo "package.json changed, running oss manifest and notices"
  npm run third-party-updates
else
  echo "package.json has not changed"
fi
