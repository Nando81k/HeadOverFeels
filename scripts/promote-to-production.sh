#!/bin/sh
# promote-to-production.sh
# Promote a validated staging build to production

set -e

# Example: Tag the current commit as 'production' and push to main
CURRENT_COMMIT=$(git rev-parse HEAD)
git tag -f production $CURRENT_COMMIT
git push origin production

echo "Promoted commit $CURRENT_COMMIT to production."

# Add deployment commands here (e.g., trigger production deploy via API, CLI, etc.)
