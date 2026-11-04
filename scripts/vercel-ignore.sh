#!/bin/sh
# Vercel exit 0 skips the build; exit 1 continues it.
if [ "${VERCEL_GIT_COMMIT_REF:-}" != main ]; then
  exit 0
fi

changes="$(git diff --name-only HEAD^ HEAD)" || exit 1

# The browser dashboard lives on GitHub Pages, not on Vercel.
if [ "$changes" = 'assets/js/admin-github.bundle.js' ]; then
  exit 0
fi

# Preserve the existing GitHub Pages-only Khung Skin skip rule.
printf '%s\n' "$changes" | grep -qx 'khungskin.html' || exit 1
if printf '%s\n' "$changes" | grep -Eqv '^(khungskin[.]html|AGENTS[.]md|vercel[.]json)$'; then
  exit 1
fi
exit 0
