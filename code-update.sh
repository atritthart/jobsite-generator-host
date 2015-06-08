#! /bin/bash

set -eu -o pipefail

BRANCH="$1"
STATIC_SITE_GEN=/opt/workplace/static-site-gen
METALSMITH_GREENHOUSE=/opt/workplace/metalsmith-greenhouse

cd "${METALSMITH_GREENHOUSE}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"
git clean --force
npm install

cd "${STATIC_SITE_GEN}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"
git clean --force
npm install
cd "${STATIC_SITE_GEN}/lib
for LIB in *; do
    cd "${STATIC_SITE_GEN}/lib/${LIB}"
    if [ -r package.json ]; then
        npm install
    fi
done
