# Interaction log — projects, project detail, exports, account

Companion to `spec.md` §§4.1, 4.2, 4.3, 4.8, 5. Every entry is derived from the captured
screenshots in `screens/`. Where a before/after pair was not captured, the entry says so.
Inferences are marked *[inferred]*.

Scope: workspace and project surfaces, statistics, inspector photos/notes, the export system,
and My Account. The floor-plan editor and scan flow are logged separately.

---

### INT-P01 — Filter the project list to Favorites

| | |
|---|---|
| **Before** | `screens/01-projects-list.jpg` — Projects list. Header: workspace avatar + `Artushhovhannisyan711177 ⌄`, caption `7 projects`, blue cloud-sync glyph right. Search field `Search this workspace`. Filter row: `All` selected as a solid dark pill (box glyph + white label), `Favorites` and `Archived` as white pills with hairline borders. 2-column grid, first cell a dashed `New Project` tile with a grey `+`. |
| **Action** | Single tap on the `Favorites` chip. |
| **After** | `screens/07-favorites-empty-state.jpg` — `Favorites` is now the solid dark pill, `All` reverts to white. Header caption changes `7 projects` → `0 projects`. The whole grid, **including the dashed New Project tile**, is replaced by a centred empty state: outline star glyph, bold `No favorites yet.`, and the explainer *"When you favorite a project, all project data is stored on-device for offline access! Any changes you make are synced as soon as you're back online."* |
| **Mechanism** | The chip row is a single-select filter over one collection, not three tabs — the header count is bound to the *filtered* result set, so it is a live readout of the query, not a workspace total. The New Project tile disappearing tells you the tile is a member of the unfiltered grid's data source rather than a fixed header element. Favorite is not a label: it is a *pin-to-device* flag that drives offline caching and sync-on-reconnect. |
| **Build note** | Model `filter: all \| favorites \| archived` as one enum on the list view-model; derive both the grid contents and the count caption from the same filtered query. Only inject the create-tile when `filter == all`. |

---

### INT-P02 — Filter the project list to Archived

| | |
|---|---|
| **Before** | `screens/07-favorites-empty-state.jpg` (or `screens/01-projects-list.jpg`) — `Favorites` (resp. `All`) selected. |
| **Action** | Single tap on the `Archived` chip. |
| **After** | `screens/08-archived-empty-state.jpg` — `Archived` becomes the solid dark pill, count reads `0 projects`, and the empty state swaps to an archive-box glyph, `Nothing archived yet.`, and *"Archived projects are stored indefinitely. You can either recover them or permanently delete them at any time."* |
| **Mechanism** | Archived is a *state*, not a deletion: the copy commits to indefinite retention and offers two exits (recover / permanently delete). So a project row carries at least `isArchived` and `isFavorite` booleans and is never hard-deleted by the archive action. Each filter ships its own bespoke empty state whose body copy teaches the feature — the empty state is the documentation. |
| **Build note** | Soft-delete with `archivedAt: Date?`; exclude archived projects from the `all` filter, and put restore + permanent-delete in the archived list's row actions. Write filter-specific empty-state copy, not a generic "nothing here". |

---

### INT-P03 — Project card overflow menu

| | |
|---|---|
| **Before** | `screens/01-projects-list.jpg` — grid of cards. Card anatomy visible in `screens/03-project-cards-detail.jpg`: plan thumbnail (or a generic document glyph when no plan exists), rust-red circular member avatar bottom-left, `···` bottom-right, then centred title `My New Project`, address line or `No Address`, and a timestamp (`11:23 AM`, `Yesterday • 12:10 PM`). |
| **Action** | Single tap on the `···` glyph in the bottom-right corner of a card (not a long-press on the card body). |
| **After** | `screens/05-project-card-overflow-menu.jpg` — a floating iOS-style menu opens anchored to the tapped card, overlapping the cards below it. Rows, each with a trailing glyph: `Favorite` with secondary line *"Make available offline"* (star), `Move` (folder), `Duplicate` (copy), and a separated `Archive…` in red (trash). The list behind is not dimmed. |
| **Mechanism** | Four operations, three of them workspace-scoped: favorite (offline pin), move (implies a folder/collection container above project level), duplicate (deep copy of the whole project tree), archive (soft delete). The trailing ellipsis on `Archive…` signals a follow-up confirmation step; the other three commit immediately. The two-line `Favorite / Make available offline` row is doing double duty as an action and as an explanation of what favoriting means. |
| **Build note** | One shared menu descriptor reused by the card `···` and the project-detail title menu (see INT-P10) so the two never drift. Only the destructive item gets red + ellipsis, and only it opens a confirm sheet. |

---

### INT-P04 — Open the workspace switcher

| | |
|---|---|
| **Before** | `screens/01-projects-list.jpg` — header shows workspace avatar, name, and a small `⌄` stepper glyph immediately after the name. |
| **Action** | Single tap on the workspace name / `⌄` glyph in the header. |
| **After** | `screens/06-switch-workspace.jpg` — a modal sheet with a grabber covers the screen: centred title `Switch Workspace`, `✕` top-right. One grouped row: a filled blue radio, the workspace name, and a yellow `Current` chip right-aligned. A full-width primary button `Select a Workspace` sits pinned at the bottom, rendered **disabled** (grey fill, grey label) because the current selection has not changed. |
| **Mechanism** | Switching is a two-step commit — pick a radio, then confirm — rather than tap-to-switch, because changing workspace re-scopes every project query and possibly the sync target. The disabled primary is the tell: the button enables only on a delta between `selectedWorkspaceId` and `currentWorkspaceId`. The `Current` chip is redundant with the radio and exists so the state survives being read at a glance. |
| **Build note** | Sheet with local `selection` state; `isEnabled = selection != current`. On confirm, tear down and rebuild the project list query rather than mutating it in place. |

---

### INT-P05 — Create a project from the dashed tile

| | |
|---|---|
| **Before** | `screens/01-projects-list.jpg` — first grid cell is a dashed-border tile with a centred grey `+` and the caption `New Project` beneath it. |
| **Action** | Single tap anywhere on the dashed tile. |
| **After** | `screens/09-new-project-created-empty.jpg` — **no wizard, no name prompt.** A project is created immediately and the app pushes straight to its detail screen, nav bar reading `My New Project ⌄` with a back chevron, `?` and share/export glyphs. `screens/02-projects-list-header-detail.jpg` shows the list header afterwards with the caption incremented to `8 projects`. |
| **Mechanism** | Creation is a single mutation with server-side defaults (`name = "My New Project"`, empty floors, empty fields) followed by a push. There is no draft state, so backing out leaves the project behind — which is why the captured workspace contains several identically named projects. The count caption is derived, so it updates on return without a manual refresh. |
| **Build note** | Keep the one-tap speed but disambiguate the default name: seed from address or `New Project — <date/time>`, and consider offering an inline rename in the nav title on first entry. |

---

### INT-P06 — Scroll the empty project detail

| | |
|---|---|
| **Before** | `screens/09-new-project-created-empty.jpg` — top of the fresh project: `Add project description…` row with a trailing pencil; an address card with a placeholder map tile and greyed `Address Line #1 / City, State / Postal Code`; a `Forms` row with clipboard glyph and chevron; `Statistics ›` with `See All` and four tiles reading `0.00 m² Floor Area`, `0.00 m² Wall Area`, `0 # Floors`, `0 # Rooms`; `Floor Plans ›` / `See All` with the caption *"Create, edit and share floor plans."* |
| **Action** | Vertical scroll down the sectioned list. |
| **After** | `screens/10-empty-project-sections.jpg` — the three collection sections in their empty form: `Floor Plans` (*"Create, edit and share floor plans."*), `Photos` (*"Add photos and share reports."*), `Files` (*"Scan or upload documents from your device."*). Each shows a round grey `+` button at the rail's leading edge followed by dashed placeholder tiles. |
| **Mechanism** | The same "collection shell" component renders three different entity types: title + chevron, a caption slot, a `See All (n)` link, and a horizontal rail whose first cell is always the create affordance. In the empty state the caption slot holds a value proposition; when populated it holds the sort order (INT-P08). Statistics render `0.00 m²` rather than `—`, i.e. the metrics engine runs over an empty model rather than being skipped. |
| **Build note** | Build one generic `CollectionSection<Item>` with `emptyCaption` / `populatedCaption` and a leading create cell. Do not special-case the empty variant into a separate view. |

---

### INT-P07 — Open a project from the grid

| | |
|---|---|
| **Before** | `screens/01-projects-list.jpg` — grid of project cards. |
| **Action** | Single tap on the card body (thumbnail or title area), away from the `···` glyph. |
| **After** | `screens/11-project-detail-populated.jpg` — push transition to project detail. Nav bar: back chevron · `My New Project ⌄` · `?` · share/export glyph. Content: yellow sync banner, description row, address card with a real Google map thumbnail (`4489 Rue de Palerme / Montréal, QC H1S 3B9 / Canada`), `Forms`, `Statistics` tiles reading `78.68 m² Floor Area`, `212.70 m² Wall Area`, `1 # Floors`, `9 # Rooms`, then `Floor Plans  See All (1)` with the caption *"Sorted by floor level"*. |
| **Mechanism** | Tap targets are split within one card: body = navigate, `···` = act. The detail screen is a scroll of sections over one aggregate root; counts in `See All (n)` and the statistics tiles are all derived from the same loaded project graph, which is why an unopened project can show a thumbnail but no numbers. |
| **Build note** | Give the card an explicit hit-test split so the overflow button does not swallow navigation taps. Load the full project graph on push; render the sections from derived values, never from denormalised counters. |

---

### INT-P08 — Sync banner `Apply`

| | |
|---|---|
| **Before** | `screens/11-project-detail-populated.jpg` — a full-width soft-yellow banner directly under the nav bar: cloud glyph, dark text `Workspace update available`, and a small dark `Apply` button at the trailing edge. The same banner appears inside the room inspector (`screens/50-room-inspector-photos-notes.jpg`), so it is global chrome, not project-detail chrome. |
| **Action** | Single tap on `Apply`. |
| **After** | **Not captured** — no post-apply frame exists in this set. Expected: banner dismisses and the project reloads with remote changes merged *[inferred]*. |
| **Mechanism** | Sync is explicit and user-triggered: remote changes are detected and announced but never merged silently, which matters when a second field tech is editing the same project. The banner persists across screens, so the "update available" flag lives on the workspace/session, not on a view. |
| **Build note** | Model a `pendingRemoteUpdate` flag at session scope and render one persistent banner from app chrome. Apply should be an explicit merge step with a visible result, not a background pull. |

---

### INT-P09 — Scroll the populated project detail through Floor Plans, Photos and Files

| | |
|---|---|
| **Before** | `screens/11-project-detail-populated.jpg` — statistics tiles and the top of the Floor Plans rail. |
| **Action** | Vertical scroll down. |
| **After** | `screens/12-project-detail-floorplans-photos.jpg` then `screens/13-project-detail-files.jpg`. Floor Plans: `See All (1)`, caption *"Sorted by floor level"*, leading `+` circle, one thumbnail labelled `2nd Floor`. Photos: `See All (39)`, caption *"Sorted by last modified"*, thumbnails carrying a `▶ 0:18` video badge and a small member-avatar dot, captions in the form `2nd Floor • 3rd bedroom` over `Jul 12 • 10:33 AM`. Files: `See All (1)`, caption *"Sorted by last modified"*, a thumbnail with a `PDF` corner badge titled `My New Project Report`, `Yesterday • 11:15 AM`. Below Files: a grey `DID YOU KNOW?` tip card promoting the estimating feature with a `Learn more…` link, then a `Created By` card with the member avatar, account name and `Jul 12 • 10:16 AM`. |
| **Mechanism** | Each rail is the same shell with a different sort key surfaced as text — floor plans sort by floor level (a domain ordering), photos and files by last modified. The photo caption `<Floor> • <Room>` proves photos are attached to the entity that owns them, not to a flat project album; the project Photos section is a *rollup view* over the entity tree. Files is the sink for generated exports (INT-P21), so exports are first-class persisted artefacts, not one-shot shares. |
| **Build note** | Photos: store `ownerEntityRef` and derive the breadcrumb caption; don't duplicate photos into a project album. Files: persist every generated export with its source settings so it can be re-shared or regenerated. |

---

### INT-P10 — Project title `⌄` menu

| | |
|---|---|
| **Before** | `screens/14-project-detail-sandbox.jpg` — project detail for the sandbox project (stats `10.00 m² Floor Area`, `29.52 m² Wall Area`, `1 # Floors`, `1 # Rooms`, one `Ground Floor` thumbnail). Nav title reads `My New Project ⌄`. |
| **Action** | Single tap on the nav-bar title or its `⌄` glyph. |
| **After** | `screens/15-project-title-menu.jpg` — a menu drops from the title, covering the top of the content: `Export…` (share glyph), separator, `Edit Project Details` (pencil), separator, `Favorite` / *"Make available offline"* (star), `Move` (folder), `Duplicate` (copy), separator, `Archive…` in red (trash). |
| **Mechanism** | Superset of the card menu (INT-P03) plus the two project-scoped verbs that only make sense once you are inside: export and edit-details. The nav title doubles as a menu button, which keeps the toolbar free for `?` and share. Separators group by kind: produce-something / edit-something / organise / destroy. |
| **Build note** | Share one menu model between card and title, with the extra items gated by a `context: .list \| .detail` parameter. |

---

### INT-P11 — Edit Project Details → Project Info

| | |
|---|---|
| **Before** | `screens/15-project-title-menu.jpg` — title menu open. |
| **Action** | Single tap on `Edit Project Details`. |
| **After** | `screens/16-project-info-claim-details.jpg` — push to `Project Info` (back chevron, centred title, **no explicit Save/Done**). Grouped inset rows, label left, value right: `Project Name` → `My New Project`; `Project Description` → grey `Add Text`. Section `General`: `Author` → `Add Text`; `Project creation date` → `📅 August 14, 2026 ⌄`; `Living Area Calculation` with a `⌄` chevron (collapsed). Section header `Claim Details` with a blue `Edit ↗` at its trailing edge, then `Front View Photo` (a `+` tile plus three empty dashed slots) and the text fields. |
| **Mechanism** | Editing is inline and auto-committing — there is no Save button, so each row writes on change. The row shapes encode the field type: free text shows an `Add Text` placeholder, dates show a calendar glyph and a stepper chevron, enums show `Select ›`, photos show a tile grid. `Claim Details` is a *field group*, not hard-coded UI: it has its own header and its own `Edit ↗` affordance. |
| **Build note** | Render this screen from a field-schema array (`type`, `label`, `value`, `required`) rather than hand-laying rows; you get custom groups for free. Auto-save per field with optimistic local write. |

---

### INT-P12 — Expand Living Area Calculation and set its rules

| | |
|---|---|
| **Before** | `screens/16-project-info-claim-details.jpg` — `Living Area Calculation` row collapsed, chevron pointing down. |
| **Action** | Single tap on the `Living Area Calculation` row. |
| **After** | `screens/17-living-area-calculation.jpg` — the row expands in place (chevron flips to `^`) and reveals, inside the same General group: `Include interior walls` with an iOS toggle in the **off** position; `Include areas with a min. height` with a stepper value `2.134 m`; grey helper text *"You can specify the percentage for each room included in the calculation:"*; then one numeric row per room type — `Basement (%) 0`, `Archives (%) 100`, `Attic / Loft (%) 100`, `Balcony (%) 0`, `Bathroom (%) 100`, `Bedroom (%) 100`, continuing below the fold. Sub-interactions: the toggle flips on tap; the min-height value is a stepper/measurement control; each percentage is an editable numeric field. |
| **Mechanism** | This is a per-project rules engine, not a preference. Three inputs: a wall-inclusion boolean, a minimum-ceiling-height threshold (`2.134 m` = 7 ft, the ANSI Z765 line), and a percentage table keyed by room type. Total living area = Σ(room area × room-type % × height-eligible portion), with each room able to override its own `Living Area (%)`. Defaults encode the standard: unfinished/outdoor types (Basement, Balcony) at 0%, habitable types at 100%. The values are stored on the project, so two projects can legitimately report different living areas for identical geometry — which is exactly why it must be per-project and visible. |
| **Build note** | Persist `livingAreaConfig` on the project: `{ includeInteriorWalls: Bool, minHeight: Measurement, percentages: [RoomType: Int] }`, seeded from a jurisdiction default. Compute living area lazily from geometry + config so editing a percentage updates statistics without a re-scan. |

---

### INT-P13 — Claim Details field group

| | |
|---|---|
| **Before** | `screens/16-project-info-claim-details.jpg` — top of the `Claim Details` group visible: `Front View Photo` tile row, `Job Number`, `Carrier Name`, `Insurance Claim Number`, `Adjuster Name`, `Adjuster Email`, `Property Type ›`. |
| **Action** | Scroll down; then (separately) tap a field, or tap the blue `Edit ↗` in the group header. |
| **After** | `screens/18-claim-details-fields.jpg` — the full group: the five text/email rows all showing `Add Text`, then `Property Type  Select ›`, `Type of Loss  Select ›`, `Loss Date  📅 Select ⌄`. **The result of tapping `Edit ↗` is not captured** — the `↗` glyph marks it as leaving the app (web console) *[inferred]*. |
| **Mechanism** | Six distinct field types in one group — text, email, single-select enum, date, and a photo array — which is the strongest evidence that fields are schema-driven records rather than columns on the project table. Group-level `Edit ↗` means the *schema* is editable, but authoring happens off-device; the phone is a data-entry client for a template defined elsewhere. `Front View Photo` being a first-class typed field (a tile grid with a `+`, not a generic attachment) shows photo is a field type, not just an attachment area. |
| **Build note** | `FieldGroup { id, name, fields: [FieldDefinition] }` attachable to any entity, with values stored per entity per field id. Ship a Claim Details group as seed data. Keep schema editing out of the mobile client initially, but make the runtime renderer handle every type from day one. |

---

### INT-P14 — Statistics `See All`

| | |
|---|---|
| **Before** | `screens/14-project-detail-sandbox.jpg` — `Statistics ›` section header with four summary tiles and a blue `See All` at the trailing edge. |
| **Action** | Single tap on `See All` (the section title + `›` chevron is the same target *[inferred]*). |
| **After** | `screens/67-statistics-rooms.jpg` — a modal sheet with grabber: centred `Statistics`, `✕` top-right, stock segmented control `Rooms | Objects` (Rooms selected). Header `Summary`, then grouped rows, each `label — value — blue (i)`: `Floors 1`, `Rooms 1`, `Doors 1`, `Windows 0` · `Ground surface with all walls 13.50 m²`, `with interior walls 10.00 m²`, `without walls 10.00 m²` · `Walls with openings 31.72 m²`, `without openings 29.52 m²` · `Ceiling perimeter 13.00 m`, `Ground perimeter 12.10 m` · `Above grade living area 10.00 m²`, `Below grade living area 0.00 m²`, `Total living area 10.00 m²` · `Volume 24.40 m³`. |
| **Mechanism** | The four tiles are a projection of this sheet; `See All` opens the full measurement contract. The visual grouping is the taxonomy: counts, ground surfaces, wall areas, perimeters, living areas, volume. Precision is fixed per unit class (areas 2 dp m², lengths 2–3 dp m, volume 2 dp m³). Every row is independently defined — three different "ground surface" numbers coexist deliberately. |
| **Build note** | Define each metric as a named pure function over the project geometry + living-area config, and render the list from that registry so the sheet, the tiles and the CSV export cannot diverge. |

---

### INT-P15 — Statistic definition popup

| | |
|---|---|
| **Before** | `screens/67-statistics-rooms.jpg` — every metric row carries a blue `(i)` at its trailing edge. |
| **Action** | Single tap on the `(i)` of a row (here `Ground surface with all walls`). |
| **After** | `screens/68-statistic-definition-popup.jpg` — a small centred alert overlays the sheet (list dims slightly and has scrolled by one row): bold title `Ground surface with all walls`, body *"'Ground surface with all walls' is the area of the building's footprint based on exterior dimensions. This area is computed by measuring to the outside face of exterior walls without deductions."*, single full-width `OK`. No other dismissal control. |
| **Mechanism** | The definition is part of the data contract, not help content: the popup names the reference surface (outside face of exterior walls) and the exclusion rule (no deductions), which is what makes the number defensible when an adjuster disputes it. A one-button alert means definitions are read-only reference, never a settings entry point. |
| **Build note** | Attach a `definition` string to each metric in the registry from INT-P14 and render `(i)` automatically for any metric that has one. Write the definitions before writing the formulas — they are the spec. |

---

### INT-P16 — Statistics `Objects` tab

| | |
|---|---|
| **Before** | `screens/67-statistics-rooms.jpg` — segmented control with `Rooms` selected (white thumb left). |
| **Action** | Single tap on the `Objects` segment. |
| **After** | `screens/69-statistics-objects.jpg` — thumb slides right, content replaced entirely. No `Summary` block; instead a category header `Doors` followed by one row: small isometric object render, `Arch Door`, count `1` right-aligned. Sheet chrome (grabber, title, `✕`) unchanged. |
| **Mechanism** | Same sheet, two different report types: Rooms is a metrics table, Objects is a bill of materials grouped by catalogue category with counts. It reads directly off placed-object instances, so inserting a door in the editor changes both this list and `Doors 1` on the Rooms tab. Empty categories are omitted rather than shown at zero. |
| **Build note** | Group placed objects by `catalogueItem.category`, count by `catalogueItem.id`, and reuse the catalogue thumbnail. This list is also what the Statistics CSV export must emit (INT-P30). |

---

### INT-P17 — Inspector tab switch (Details / Photos & Notes / Forms)

| | |
|---|---|
| **Before** | `screens/50-room-inspector-photos-notes.jpg` — inspector for the `Kitchen` room (nav subtitle `2nd Floor`), sync banner present, segmented control `Details | Photos & Notes | Forms` with `Photos & Notes` selected. Content: a `Photos` section — grid whose first cell is a `+` tile, then five thumbnails (one carrying a `0:33` video badge) and remaining dashed empty slots; a `Notes` section — a single white card with grey placeholder `Add note…`. |
| **Action** | Single tap on the `Forms` segment. |
| **After** | `screens/51-forms-empty-state.jpg` — same nav bar, same banner, thumb moves to `Forms`, body replaced by a centred empty state: clipboard glyph, `No forms yet.`, *"Reduce paperwork by creating report templates, forms, questionnaires, checklists, and so much more!"*, and a small `Learn more ↗` button. |
| **Mechanism** | The identical three-tab inspector appears for room (`50`, `51`) and object (`65`, `66`) — the tab set is a property of *any* entity, not of a screen. Photos and Notes share one tab because both are unstructured evidence; Forms is structured capture and is authored externally (`↗`). |
| **Build note** | One `EntityInspector(entity:)` view with three tabs, driven by protocol conformance (`hasPhotos`, `hasNotes`, `hasForms`). Do not fork per entity type. |

---

### INT-P18 — Add a photo: source menu

| | |
|---|---|
| **Before** | `screens/65-add-note-modal.jpg` (upper portion) — object inspector for `Arch Door` / `Ground Floor`, a collapsible `ⓘ Arch Door ⌄` header row, tabs with `Photos & Notes` selected, an empty `Photos` grid whose first cell is a `+` tile. |
| **Action** | Single tap on the `+` tile in the Photos grid. |
| **After** | `screens/66-photo-source-menu.jpg` — a small menu opens anchored to the `+`: `Camera` with secondary line *"Take Photo, 360 or Video"* (camera glyph); `Photo Library` with *"Choose Photo or Video"* (photos glyph). No third option, no "scan document" here. |
| **Mechanism** | Two sources only, but the first bundles three capture modes — 360° photo is promoted to the same tier as stills and video, which implies the media model is `{ still, photo360, video }` rather than image-with-a-flag. The menu is anchored to the `+` inside the currently selected entity's grid, so the capture is attached to that entity by construction; there is no "which room is this photo for?" step anywhere. |
| **Build note** | `MediaItem { kind: still \| photo360 \| video, ownerRef, capturedAt, author }`. Route capture through the owning entity so attachment is implicit. Respect the `Save to Photo Library` preference (INT-P32) at capture time. |

---

### INT-P19 — Add a note: `Add Text` modal

| | |
|---|---|
| **Before** | `screens/65-add-note-modal.jpg` (background) — the object inspector's `Notes` section with the grey `Add note…` placeholder. |
| **Action** | Single tap on the `Add note…` field. |
| **After** | `screens/65-add-note-modal.jpg` (foreground) — a bottom sheet rises over the inspector, which stays visible above it: `Cancel` (blue, left) · `Add Text` (centred title) · `Save` (right, rendered **grey/disabled** while the field is empty). Below, a single white multi-line text field with an active caret. |
| **Mechanism** | Notes are modal and explicitly committed — unlike the auto-saving field rows in Project Info (INT-P11) — because free text needs a discard path. `Save` disabled-until-non-empty prevents empty notes. The note attaches to whatever is selected: here an *object* (Arch Door), which confirms notes exist at every level of the hierarchy, not just at room level. |
| **Build note** | Reuse one `TextEntrySheet(title:initialValue:)` for notes everywhere; gate `Save` on non-empty and dirty. Store notes as an ordered array on the owning entity with author + timestamp. |

---

### INT-P20 — Open the export hub

| | |
|---|---|
| **Before** | `screens/11-project-detail-populated.jpg` — nav bar share/export glyph at the far right (the same action is reachable as `Export…` in the title menu, `screens/15-project-title-menu.jpg`). |
| **Action** | Single tap on the nav-bar share glyph. |
| **After** | `screens/70-export-hub.jpg` — modal sheet `Export Floor Plans`, `✕` top-right, segmented `Exports | Integrations` (Exports selected). Rows, each `glyph + title + subtitle + trailing sliders button`: `Report PDF` *"Get your project report in PDF format"*; `Sketch PDF` *"Get your sketch in PDF format"*; `Sketch Files` *"Get your sketch in various file formats"*; `3D Model` *"Get the 3D model in various file formats"*; `Statistics` *"Get statistics such as areas and perimeters of rooms and objects"*. Then a blue row `Previously Generated Files` *"Jump to the 'Files' section to view & share all your previously generated files"*. Group `Share Links`: `Send a copy via email` *"Share an editable copy of your floor plan"* and `Get Shareable Link` *"Choose what to share, who to share with, and at which access level"*, both with plain `›` chevrons. |
| **Mechanism** | Five artefact generators plus two distribution channels, kept in separate groups — generating and sending are different verbs. Every generator row taps into a settings screen first (INT-P22 onward): nothing generates blind. `Previously Generated Files` is a cross-link back to the project's Files section (`screens/13-project-detail-files.jpg`), closing the loop: generate → persist → re-share. `Send a copy via email` sharing an *editable* copy implies a project-transfer format distinct from the flat PDF outputs. |
| **Build note** | `ExportKind` enum → settings view → generator → persisted `File` on the project. Distribution reads from persisted files rather than regenerating. |

---

### INT-P21 — `Integrations` tab

| | |
|---|---|
| **Before** | `screens/70-export-hub.jpg` — segmented control with `Exports` selected. |
| **Action** | Single tap on the `Integrations` segment. |
| **After** | `screens/71-integrations-empty.jpg` — body replaced by a centred empty state: bidirectional-arrows glyph, `No integrations yet.`, *"Integrate with other industry-leading tools to seamlessly share floor plan data."*, `Learn more ↗`. Sheet chrome unchanged. |
| **Mechanism** | Third-party destinations are modelled as peers of file exports inside the same sheet, so "where does this data go" is one decision surface. Nothing is connected on this account, so the connect/authorise flow is unobserved. |
| **Build note** | Keep integrations in the same sheet as file exports; a connected integration should appear as an additional destination row rather than a separate menu. |

---

### INT-P22 — Open `Report PDF` settings

| | |
|---|---|
| **Before** | `screens/70-export-hub.jpg` — `Report PDF` row with its trailing sliders button. |
| **Action** | Single tap on the row (or its sliders button). |
| **After** | `screens/73-report-pdf-settings-1.jpg` — settings screen with `Cancel` · `Report PDF` · blue `Done`. Groups: **Page Layout** — a row with a layout diagram glyph, label `Select Page Layout`, and a full-width secondary button `All Floors & All Rooms ›`. **Page Size** — `Page Size  US Letter ›`. **Room Labels** — `Room Labels  Show all room names ›`. **Scale** — `Display scale` toggle **on** (with a scale-bar glyph), `Floor Scale  Scale that maximizes plan size ›`, `Room Scale  Scale that maximizes plan size ›`, `Rotate plan to maximize scale` **on**, `Use the same scale for all floors` **on**. Below, the `Floor Plan Dimensions` group begins with a sample plan thumbnail (`Kitchen / 3.6 x 4.2 / 15 m²`). |
| **Mechanism** | `Cancel`/`Done` framing makes the whole screen a transaction — settings are staged and only committed (and the artefact generated) on `Done`. The scale group exposes the real print problem: fit-to-page per floor, per room, rotation, and a cross-floor consistency switch that trades size for comparability. The inline thumbnail is a **static illustration** — the same `Kitchen / 3.6 x 4.2 / 15 m²` sample appears in Sketch PDF settings (`screens/78-sketch-pdf-title-block.jpg`), so it is not the user's plan. |
| **Build note** | One `ExportSettings` value type per kind, staged in the sheet and committed on `Done`; persist last-used settings per project. Wire the preview thumbnail to the actual first room — cheap, and it removes a class of "the PDF didn't look like the preview" complaints. |

---

### INT-P23 — `Select Page Layout` (shared component)

| | |
|---|---|
| **Before** | `screens/73-report-pdf-settings-1.jpg` — `Select Page Layout` row showing the current value. |
| **Action** | Single tap on the value button. |
| **After** | `screens/72-select-page-layout.jpg` — push to a screen titled `Select 1 item` with a back chevron. Group header `Select Page Layout`, four radio rows each paired with a small page-layout diagram: `All floors in one file` (selected, filled blue radio), `One floor per file`, `One floor per page & one room per page`, `One floor per page & two rooms per page`. Selection commits on tap and returns via the back chevron; there is no Done button. |
| **Mechanism** | Generic single-select screen (`Select 1 item`) reused across export kinds — the same component backs Sketch PDF and Sketch Files, which show different current values (`All floors in one file`, `One floor per file`). The layout diagrams carry the meaning; the labels alone are ambiguous about file-vs-page splitting, and the two are genuinely different axes (how many files, how many entities per page). |
| **Build note** | One reusable `SingleSelectList(title:options:selection:)` with an optional per-option diagram asset. Model page layout as `{ filesPerFloor: Bool, roomsPerPage: Int? }` rather than four opaque enum cases, or the report renderer will grow a switch statement per feature. |

---

### INT-P24 — Floor Plan Dimensions toggles

| | |
|---|---|
| **Before** | `screens/73-report-pdf-settings-1.jpg` — the `Floor Plan Dimensions` group just entering view under the Scale group. |
| **Action** | Scroll down; tap individual toggles. |
| **After** | `screens/74-report-pdf-settings-2.jpg` — the group in full: the sample thumbnail on top, then `Detailed dimensions` **on**, `Main dimensions` **on**, `Area` **on**, and `Only dimensions that have been manually set` **off**. Below: group `Room Plan Dimensions` with `Select Dimensions  All dimensions ›`. |
| **Mechanism** | Floor-level and room-level dimension rendering are configured separately (a floor plan is crowded, a room plan is not). `Only dimensions that have been manually set` is the export-side consumer of the per-dimension `isManuallySet` flag written during measurement entry (the padlock glyph in the editor) — it lets a user publish only the numbers they physically measured and suppress derived ones. That single toggle is why the flag must exist on every dimension from the start. |
| **Build note** | Store `isManuallySet: Bool` per wall dimension at entry time and filter on it at render time. Keep floor-plan and room-plan dimension settings as two independent structs. |

---

### INT-P25 — `Include Attachments`

| | |
|---|---|
| **Before** | `screens/74-report-pdf-settings-2.jpg` — bottom of the dimension groups. |
| **Action** | Continue scrolling; tap any row to open its sub-selector. |
| **After** | `screens/75-report-pdf-settings-attachments.jpg` — group `Include Attachments`, five rows each with a glyph and a current-value chevron: `Dimensions  Selected Only ›`, `Fields  All ›`, `Photos & Videos` with a full-width value button `Photos, 360° Photos, Videos ›`, `Notes  All ›`, `Forms  All ›`. **The sub-selector screens behind these rows were not captured**; by analogy with INT-P23 they are single/multi-select lists *[inferred]*. |
| **Mechanism** | This group is the report's content contract: exactly the per-entity data types from the inspector (fields, photos/videos, notes, forms) plus dimensions, each independently scoped `All / Selected Only / …`. It maps one-to-one onto the data model, so adding a new attachable type means adding one row here. `Photos, 360° Photos, Videos` being a multi-value chip confirms media kind is a first-class distinction (see INT-P18). |
| **Build note** | Derive these rows from the attachable-type registry rather than hard-coding five rows; each row's scope is a filter passed to the renderer. |

---

### INT-P26 — `Forms`, `Pictures` and `Disclaimer`

| | |
|---|---|
| **Before** | `screens/75-report-pdf-settings-attachments.jpg` — `Forms` group header appearing at the bottom edge. |
| **Action** | Scroll to the end of the settings screen; tap toggles / the `Photos size` value / the disclaimer text block. |
| **After** | `screens/76-report-pdf-settings-pictures.jpg` — group `Forms`: `Place each form on its own page` **off**. Group `Pictures`: `Photos size  Small ›`, `Place photos on dedicated pages` **on**, `Show photo captions` **on**, `Show miniature photos in annotations` **off**. Group `Disclaimer`: a white editable multi-line text block pre-filled with the vendor's standard warranty-disclaimer paragraph (all caps). |
| **Mechanism** | Pagination controls (`own page`, `dedicated pages`) are separated from content controls because they change page count and therefore print cost. `Show miniature photos in annotations` inlines evidence next to the plan geometry rather than in a photo appendix — the two placements are mutually useful, hence two independent toggles. The disclaimer being *editable inline* means the legal text is project-level (or workspace-level) data with a vendor default, not a hard-coded string. |
| **Build note** | Make the disclaimer a workspace-level default overridable per export. Model the report as a document tree (sections → blocks) so pagination toggles are layout policy, not renderer branches. |

---

### INT-P27 — `Sketch PDF` settings and Title Block

| | |
|---|---|
| **Before** | `screens/70-export-hub.jpg` — `Sketch PDF` row. |
| **Action** | Tap the row; then scroll to the bottom of the settings screen. |
| **After** | `screens/77-sketch-pdf-settings-1.jpg` — `Cancel · Sketch PDF · Done`. Same shell as Report PDF but: `Select Page Layout  All floors in one file ›`; the Page Size group carries a **second** full-width button `Portrait ›` (orientation); a new group `Annotations` with `Hide annotation objects` **on**; then the identical Scale group. `screens/78-sketch-pdf-title-block.jpg` — scrolled to the end: the same static `Kitchen / 3.6 x 4.2 / 15 m²` sample, `Detailed dimensions` on, `Main dimensions` on, `Area` on, `Only dimensions that have been manually set` off, the editable `Disclaimer` block, then group `Title Block`: `Display Title Block` **on**, `Display the number of floors & rooms` **on**, `Display Area` **on**, `Show personal email` **on**. |
| **Mechanism** | Sketch PDF is Report PDF minus the attachment/pictures/forms groups and plus two drawing-specific ones. `Hide annotation objects` suppresses the Annotations catalogue category so the same plan serves as a clean drawing or a marked-up one without editing the model. The Title Block is the drawing's cartouche — project summary metadata printed on the sheet — and `Show personal email` is a privacy switch on branding data pulled from Company Profile (INT-P35). |
| **Build note** | Compose export settings from shared groups (`PageLayout`, `PageSize`, `Scale`, `Dimensions`, `Disclaimer`) plus kind-specific ones; do not copy the Report PDF screen. Title-block content should read from the workspace/company profile with per-export visibility flags. |

---

### INT-P28 — `Sketch Files` format selection

| | |
|---|---|
| **Before** | `screens/70-export-hub.jpg` — `Sketch Files` row. |
| **Action** | Tap the row; then toggle individual formats. |
| **After** | `screens/79-sketch-files-formats.jpg` — `Cancel · Sketch Image Files · Done` (note the title is longer than the hub label). Groups: **Page Layout** — `Select Page Layout  One floor per file ›`, plus `Generate room images` toggle **off**. **File formats** — four rows, each a branded file glyph + name + description + toggle, all **on**: `JPG` *"An opaque image for each floor plan, without headers, pictures, or annotations"*; `PNG` *"A transparent image for each floor plan, without headers, pictures, or annotations"*; `DXF` *"One file per floor in vector format. DXF files can be imported into CAD software."*; `SVG` *"One file per floor in vector format."* **Keep Aspect Ratio** — two stacked full-width buttons `3:2 ›` and `Portrait ›`. **Room Labels** — `Show all room names ›`. |
| **Mechanism** | Multi-select rather than radio: one run can emit four formats at once, so the generator is a fan-out over enabled formats. Each description states the two things that decide the choice — transparency/opacity and what is omitted (headers, pictures, annotations) for raster; per-floor granularity and CAD importability for vector. `Generate room images` adds a second granularity (per-room rasters) on top of the page layout. |
| **Build note** | `Set<FileFormat>` in the settings struct, one renderer per format behind a common protocol. Put the "what's in it / what's missing" sentence in the UI — it prevents the support ticket. |

---

### INT-P29 — `3D Model` format selection

| | |
|---|---|
| **Before** | `screens/70-export-hub.jpg` — `3D Model` row. |
| **Action** | Tap the row; then toggle formats. |
| **After** | `screens/80-3d-model-formats.jpg` — `Cancel · 3D Model · Done`. A single group `File formats` with three rows: `OBJ` *"One 3D model per floor"* **off**; `IFC` *"One 3D model per project for BIM processes"* **on**; `USDZ` *"One 3D model per floor for augmented reality"* **on**. No page layout, page size or scale groups. |
| **Mechanism** | The simplest settings screen in the system — 3D has no pagination problem, so the shell collapses to just the format fan-out. Granularity differs *per format and is not user-configurable*: IFC is whole-project because BIM consumers expect one federated model; OBJ and USDZ are per-floor. Defaults are opinionated (BIM + AR on, generic mesh off), which tells you who the buyer is. |
| **Build note** | Keep per-format granularity as a property of the format, not a user setting. Reuse the same format-row component as INT-P28. |

---

### INT-P30 — `Statistics` export settings

| | |
|---|---|
| **Before** | `screens/70-export-hub.jpg` — `Statistics` row. |
| **Action** | Tap the row. |
| **After** | `screens/81-statistics-export-settings.jpg` — `Cancel · Statistics · Done`. **File formats** — `PDF` *"A detailed report containing formatted text, vector drawings, and photos, depending on selected options."* **on**; `CSV` *"A file containing a list of values separated with commas. CSV files can be imported into spreadsheet applications such as Microsoft Excel."* **on**. **Page Size** — `US Letter ›`. **Include** — `Furniture` **on**, `Wall Objects` **on**. **Disclaimer** — the same editable legal text block. |
| **Mechanism** | Same numbers, two audiences: a formatted PDF for the claim file and a CSV for downstream estimating. `Include: Furniture / Wall Objects` filters the Objects bill of materials (INT-P16) by placement class — wall-mounted openings and fixtures versus free-standing furniture — which implies the catalogue tags each item with a placement type. Page Size applies only to the PDF branch but is not visibly gated on it. |
| **Build note** | Generate both formats from one statistics snapshot so the CSV can never disagree with the PDF. Tag catalogue items with `placement: .wall \| .floor \| .annotation` and drive the Include filters off that tag. |

---

### INT-P31 — Switch to the `My Account` tab

| | |
|---|---|
| **Before** | `screens/01-projects-list.jpg` / `screens/04-tab-bar-detail.jpg` — two-item tab bar, `Projects` active in blue with a grid glyph, `My Account` inactive grey with a person glyph. |
| **Action** | Single tap on `My Account`. |
| **After** | `screens/82-my-account.jpg` — root account screen, no back chevron, centred title `My Account`. Grouped rows: `Profile` with member avatar and account email. A group labelled `Workspace` with the workspace name and an `Owner` badge, containing `Company Profile ›`, `Subscription  Report ›`, and blue `Invite Members ↗`. Then `App Preferences ›`, `Privacy ›`. Then `Help & Support ›`, blue `Create & Share Diagnostics ⧉`, `Report a Bug ↗`, `Suggest a Feature ↗`, `What's New ↗`. Finally `Rate App`. Tab bar updates: `My Account` blue, `Projects` grey. |
| **Mechanism** | Only two tabs, so everything non-project lives in one grouped list. The `Workspace` group header carries the role badge, which is how permission scope is communicated — `Invite Members` is presumably owner-only *[inferred]*. Glyph vocabulary is consistent and load-bearing: `›` stays in-app, `↗` leaves for the web, `⧉` opens the system share sheet. `Subscription` showing its tier inline (`Report`) makes entitlement legible without a tap. |
| **Build note** | Two tabs; put role-gated rows behind a capability check rather than hiding them silently. Adopt the `›` / `↗` / `⧉` distinction as a rule — users learn it in one session. |

---

### INT-P32 — `App Preferences`

| | |
|---|---|
| **Before** | `screens/82-my-account.jpg` — `App Preferences ›` row. |
| **Action** | Single tap on the row. |
| **After** | `screens/83-app-preferences.jpg` — push to `App Preferences`. Group `App Settings`: `Measurement Unit` with subtitle *"Applies to new projects. Existing projects will not be affected."* and stepper value `Metric`; `AR "Room Scan" Mode` with subtitle *"Choose how rooms are scanned when using the Camera (AR)."* and stepper value `Detect Walls`; `Save to Photo Library` with subtitle *"Store a copy of the photos and videos captured using the in-app camera in the native Photos app."* and a toggle **off**. Group `Cloud Settings`: `Sync Projects`, *"Choose when to update projects across devices."*, value `Wi-Fi & Cellular`. Then a red `Clear Cache` row with *"Free up disk space by clearing the local cache. Projects marked as favorites are unaffected."* Finally `Third-Party Licenses ↗`. |
| **Mechanism** | Every row carries its own consequence sentence, and two of them are load-bearing: measurement unit is copied into a project at creation and never retro-applied (so unit is project state, not a global render setting), and Clear Cache is safe precisely because favourited projects are pinned on-device (INT-P01). Sync policy is a user choice, consistent with the explicit-sync banner (INT-P08). |
| **Build note** | Snapshot `measurementUnit` onto the project at creation. Make the favourite flag the exemption rule for any cache eviction, and say so in the UI. |

---

### INT-P33 — `AR "Room Scan" Mode` picker

| | |
|---|---|
| **Before** | `screens/83-app-preferences.jpg` — `AR "Room Scan" Mode` row with stepper value `Detect Walls`. |
| **Action** | Single tap on the value control. |
| **After** | `screens/84-ar-scan-mode-options.jpg` — a menu opens anchored to the value, overlapping the rows below: `Detect Walls` with subtitle *"Use LiDAR sensors for better accuracy"* and a leading `✓`; `Detect Corners` with subtitle *"Use legacy method that does not rely on LiDAR sensors."* |
| **Mechanism** | Two independent capture engines behind one preference — a LiDAR plane-detection path and a legacy corner-tapping path — with the trade-off (accuracy vs hardware requirement) stated in each subtitle rather than buried in help. It is a global preference, not per-scan, so the choice is a device-capability decision made once. |
| **Build note** | Define a `ScanEngine` protocol with two implementations and select at scan start from this preference; default to the LiDAR path when the device reports a depth sensor, and fall back automatically rather than showing a broken option. |

---

### INT-P34 — `Privacy`

| | |
|---|---|
| **Before** | `screens/82-my-account.jpg` — `Privacy ›` row. |
| **Action** | Single tap on the row. |
| **After** | `screens/85-privacy.jpg` — push to `Privacy`. One toggle row `Share Analytics`, **on** (green with a check glyph in the knob), followed by grey helper text *"Thank you for helping magicplan improve its product and services by automatically sending diagnostic and usage data."* with an inline blue `About Analytics & Privacy…` link. Then a separate group of three blue rows with external glyphs: `Privacy Policy ↗`, `Terms of Service ↗`, `License Agreement ↗`. |
| **Mechanism** | One toggle, one sentence of consequence, one deep link for detail, then the legal documents as web links. Nothing else on the screen — the analytics consent is deliberately not buried among other settings. |
| **Build note** | Keep the analytics opt-out on its own screen with the explanatory sentence adjacent to the control; host the three legal documents as versioned web pages, not bundled text. |

---

### INT-P35 — Watermark preview (Company Profile)

| | |
|---|---|
| **Before** | `screens/82-my-account.jpg` — `Company Profile ›` in the Workspace group. |
| **Action** | Tap the row, then scroll to the bottom of the Company Profile screen. |
| **After** | *(screenshot withheld — contains real business contact details)* — bottom of `Company Profile`. Above: an editable contact card (phone / email / website / a greyed `Fax` placeholder) and an address card with a chevron — the actual values are the account owner's real business details and are not reproduced here. Below them, a white card titled `Watermark Preview` rendering the branded export header schematically: three short grey text lines top-left (the company text block), a `LOGO` placeholder top-right, a line-drawn floor plan filling the body, and a thin footer rule. A blue `Add Watermark…` link sits at the card's bottom edge. |
| **Mechanism** | Branding is configured once at workspace level and composited into every generated export — the preview is a live-ish rendering of the header that will appear on PDFs and image exports, so the user validates branding here rather than by generating a test PDF. The `LOGO` placeholder shows the layout is fixed and slot-based (text block left, logo right, plan below, footer rule), not free-form. `Add Watermark…` (ellipsis) opens a further configuration step **not captured** in this set. |
| **Build note** | Store branding on the workspace (`logo`, `companyName`, contact block, address) and render the export header from one template shared by every export kind. Show the preview at configuration time — it is the cheapest way to catch a wrong logo before it ships to a client. |

---

## Open questions

The screenshots do not answer these:

1. **Post-`Apply` sync state** (INT-P08) — no frame after applying the workspace update; conflict handling and merge granularity unknown.
2. **Archive confirmation** — `Archive…` carries an ellipsis in both menus but the confirm sheet was never opened, so its copy and button labels are unknown. Same for whether archive is per-project or supports multi-select.
3. **`Move`** — no destination picker captured; the existence of a folder/collection layer above Project is inferred from the folder glyph alone.
4. **`Duplicate`** — no result frame; unknown whether photos, files and generated exports are copied or only the model.
5. **Search** — the `Search this workspace` field was never focused; no results, scope or empty-result frames.
6. **Sort and grid options** — the list shows an implicit ordering with no visible sort control; unknown whether one exists.
7. **Address entry** — tapping the address card (populated or placeholder) has no captured after; unknown whether it is a map picker, a form, or both.
8. **`Claim Details → Edit ↗`** and `+ New Field` — external destinations never opened; the field-schema authoring surface is undocumented.
9. **Room-type percentage editing** (INT-P12) — the numeric editor invoked by tapping a `%` value was not captured, nor the full room-type list below the fold, nor how per-room overrides interact with the project table.
10. **`Front View Photo`** — the multi-slot photo field's `+` was not tapped; unknown whether it uses the same source menu as INT-P18.
11. **Statistics sub-selectors** — `Select Dimensions`, `Include Attachments` rows (`Dimensions / Fields / Photos & Videos / Notes / Forms`) all push to unseen screens; the `All` vs `Selected Only` semantics are unverified.
12. **Export execution** — no frame between tapping `Done` and the artefact appearing in Files: progress UI, failure states, and generation time are unknown.
13. **`Send a copy via email` / `Get Shareable Link`** — deliberately not opened; the access-level model behind *"who to share with, and at which access level"* is undocumented.
14. **Integrations connect flow** — the tab is empty on this account.
15. **`Add Watermark…`** (INT-P35) — the configuration step behind the link was not captured.
16. **`Profile`, `Subscription`, `Invite Members`** — not opened; tier gating and role permissions unknown.
17. **Photos / Files `See All` galleries** and the project-level `Forms` screen — never opened, so bulk selection, deletion and reordering are undocumented.
18. **Multi-workspace behaviour** — only one workspace exists on this account, so the switcher's populated state, per-workspace sync, and cross-workspace `Move` are unobserved.
