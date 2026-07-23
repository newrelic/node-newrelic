#!/usr/bin/env bash
#
# Checks all staged files for changes to the agent's config definition or
# the schema generator itself. If either changed, regenerates the agent
# config schema and stages the result.

STAGED_FILES=$(git diff-index --cached --name-only HEAD)

SHOULD_REGENERATE=0
for FILE in $STAGED_FILES
do
  case "$FILE" in
    lib/config/default.js|lib/config/samplers.js|.fleetControl/schemaGeneration/*)
      SHOULD_REGENERATE=1
      break
      ;;
  esac
done

if [ ${SHOULD_REGENERATE} -eq 0 ]; then
  echo "Config schema inputs have not changed"
  exit 0
fi

echo "Config schema inputs changed, regenerating"
if ! node .fleetControl/schemaGeneration/generate-schema.js; then
  echo "Config schema generation failed"
  exit 1
fi

if [ -n "$(git status --porcelain .fleetControl/schemas/config.json)" ]; then
  git add .fleetControl/schemas/config.json
fi
exit 0
