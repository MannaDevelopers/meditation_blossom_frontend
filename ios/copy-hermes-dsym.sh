#!/bin/bash

# Copy Hermes dSYM to app dSYM folder
HERMES_DSYM_SOURCE="${PODS_CONFIGURATION_BUILD_DIR}/hermes-engine/hermes.framework.dSYM"

if [ -d "$HERMES_DSYM_SOURCE" ]; then
    echo "Copying Hermes dSYM..."
    ditto "$HERMES_DSYM_SOURCE" "${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM"
    echo "Hermes dSYM copied successfully"
else
    echo "Hermes dSYM not found at $HERMES_DSYM_SOURCE"
fi
