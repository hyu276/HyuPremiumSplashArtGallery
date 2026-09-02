# Responsive Rules

## 1. Objective

Every public and admin interface must remain usable, readable, visually coherent, and performant across mobile, tablet, laptop, desktop, high-DPI displays, touch input, mouse input, and common browser zoom levels.

## 2. Mobile-first behavior

- Design the smallest practical viewport first, then enhance progressively.
- Do not treat mobile as a scaled-down desktop screenshot.
- Primary actions must remain reachable without precision pointer input.
- Avoid hover-only functionality; every essential action needs a touch/keyboard equivalent.
- Mobile performance constraints are stricter than desktop constraints.

## 3. Layout rules

- No unintended horizontal page scrolling.
- Avoid fixed pixel widths for primary containers when fluid sizing is appropriate.
- Use `min()`, `max()`, `clamp()`, percentages, grid/flex, and sensible max-width constraints where they improve fluid behavior.
- Allow long names, URLs, labels, tags, and localized text to wrap safely.
- Do not solve overflow by globally hiding it if that masks broken layout.
- Fixed/sticky UI must not cover essential content or controls.

## 4. Breakpoints

- Breakpoints should follow actual content failure points, not arbitrary device brand sizes.
- Minimize the number of breakpoints needed to maintain the design.
- Avoid contradictory breakpoint rules spread across unrelated files.
- When a component needs a specific responsive rule, keep it close to the component styling when practical.

## 5. Typography and controls

- Text must remain legible without requiring zoom.
- Do not reduce important text to unreadable sizes to force content into one line.
- Interactive controls must have touch-friendly hit areas and sufficient spacing.
- Form inputs must not overflow their container.
- Buttons and labels should wrap or adapt rather than clip critical meaning.

## 6. Images and artwork

- Preserve artwork aspect ratio at every viewport.
- Never stretch an image to fit a breakpoint.
- Listing images should select suitable derivatives for their rendered size.
- Expanded artwork must retain exact-original fidelity while fitting the available viewport without distortion.
- The full image should remain inspectable; cropping should occur only when the design explicitly requires it.
- Temporary loading previews must not be upscaled into visibly soft expanded images.

## 7. Expanded artwork behavior

- Expansion must respond immediately on touch and mouse.
- On small screens, the expanded shell must fit the viewport and respect safe areas.
- Controls must remain accessible without covering the focal portion of the artwork more than necessary.
- Orientation changes must not leave stale dimensions or broken positioning.
- Do not issue extra media requests solely because the viewport crossed a breakpoint after the exact original is already available.

## 8. Responsive performance

- Avoid large backdrop blurs, mass entrance animations, or heavy compositing on mobile.
- Reduce non-essential visual effects on constrained viewports rather than reducing image fidelity.
- Do not download desktop-sized derivatives for small listing cards when a smaller existing derivative is sufficient.
- Avoid JavaScript resize handlers when CSS can solve the layout.
- If resize observation is necessary, debounce/batch expensive work and clean observers up correctly.

## 9. Navigation and interaction

- Keyboard focus order must remain logical after responsive rearrangement.
- Menus and dialogs must remain dismissible on touch and keyboard.
- Do not require hover to reveal the only path to a control.
- Prevent accidental double actions from touch/pointer event overlap.
- Respect safe-area insets where fullscreen/sticky UI reaches device edges.

## 10. Admin dashboard responsiveness

- GitHub Pages admin must remain fully usable on narrower laptop/tablet widths.
- Forms, upload controls, status messages, taxonomy controls, and publish actions must not become inaccessible due to overflow.
- Error text should wrap without breaking layout.
- Draft-preserving behavior must remain unchanged across responsive states.

## 11. Validation matrix

For responsive UI changes, verify at minimum representative widths around:

- narrow mobile: ~360 px;
- common mobile: ~390–430 px;
- tablet/narrow laptop: ~768–1024 px;
- desktop: ~1280–1440 px;
- wide desktop: >= 1920 px when the affected layout can expand that far.

Also verify at least one touch-oriented layout and keyboard navigation for affected interactive controls.

## 12. Merge rejection conditions

Do not merge responsive changes that:

- introduce horizontal scrolling;
- clip essential text or controls;
- require hover for essential functionality;
- distort artwork aspect ratio;
- reduce expanded-image sharpness to make mobile rendering easier;
- load materially larger media than the rendered listing size requires;
- degrade mobile interaction performance to preserve desktop-only effects.
