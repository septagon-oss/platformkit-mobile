# platformkit-mobile

A native shell for [PlatformKit](https://github.com/septagon-oss/platformkit).
It signs in, reads `GET /api/v1/admin/resources`, and generates a list, a detail
and a form screen for every resource the caller may reach — the same rule the
web shell follows (`docs/adr/0007` there): screens derive from schemas, and a
hand-written screen is an exception that has to earn itself.

    npm install
    npm run check          # typecheck, lint, format, unit tests
    npm start              # Expo; set EXPO_PUBLIC_API_URL to a running instance

Custom screens are renderer packs: an object mapping `module/entity` to
components, passed to `<Shell renderers={...}>` in `app/_layout.tsx`. Nothing
registers itself.

`testdata/catalog.json` is copied verbatim from the public repository's
`ui/screens/testdata/catalog.json`; `tests/derive.test.ts` reads it, so a change
to the seam the shell cannot parse fails here.
