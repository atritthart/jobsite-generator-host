#! /bin/sh

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
cd "${STATIC_SITE_GEN}/lib/imgurl-reprocessor" && npm install
cd "${STATIC_SITE_GEN}/lib/metalsmith-greenhouse-imgurl" && npm install
cd "${STATIC_SITE_GEN}/lib/metalsmith-prismic" && npm install
cd "${STATIC_SITE_GEN}/lib/swig-viewmodel" && npm install
