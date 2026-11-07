<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Reports
- Setagem deletion uses existing Ilegal edit RLS, exact-name confirmation and returned-row verification; delete only the org and cascading ficha, leaving independent online and punishment histories intact.
- Peds removal updates category/status instead of deleting rows; shared browser-safe record helpers drive active totals and effective categories so legacy removed records stay consistent across views.
- Peds uses a fixed Coordinator+ or PED/PEDS/KIDS access predicate shared by navigation and page mounting, mirrored by public.can_access_peds in RLS; identifiers are stored as text to preserve spreadsheet values and multiple IDs.
- Proposal benefit overrides are stored inside each captacao's proposta JSON, separately from the three shared level templates; preview and exports use the same resolved snapshot to preserve negotiated benefits.

- Role hierarchy, labels and ranks are defined in the browser-safe `src/lib/roles.ts` and shared with server validation and chat; new roles get an initial permission copy in `role_permissions` so assignment and permission editing remain consistent.

- Captações uses a shared area-access predicate for navigation and page mounting, mirrored by `public.can_access_captacoes` in every Captações RLS policy, so direct links, proposal editing and API access enforce the same restriction.

- Report period pickers must render through the shared `PeriodoField`
  (`src/components/periodo-field.tsx`) and the period helpers in
  `src/lib/ilegal-online.ts` (`limitesDoPeriodo`, `labelPeriodoComIntervalo`,
  `erroDoPeriodoCustom`) instead of building their own period dropdown or date
  input — so every report gets the same preset list plus the custom range, and
  the PDF headers keep naming the period the user actually picked.
- A custom range must never reach the database half-filled: keep the
  `intervaloIncompleto` guard in the fetchers so an unfinished selection returns
  no rows instead of scanning the whole history.
- Shared staff data RLS uses public.is_team_member(auth.uid()) (has a row in user_roles), never `true` or `auth.uid() IS NOT NULL` — a bare login is not staff.

## Update board
- HOST UPDATE projects live in the existing `dev_tasks` collection; add requested content there rather than seeding on page load, to preserve edits and avoid duplicate projects.
- Scope update-specific theme overrides to `.host-update-theme` and the `/update` navigation item, so the other administrative pages keep their existing theme.
- HOST UPDATE planning details use a full-screen dialog; store attachment metadata on dev_tasks and files in private Storage with signed URLs, never inline image data in descriptions.
- HOST UPDATE PDF reports fetch a fresh snapshot of dev_tasks before exporting and load the PDF generator dynamically; summarize actual statuses without inventing deadlines or progress.
