# AI Talks — Slide Design System
<!--
Purpose: A practical design specification for creating English, LTR presentation slides inspired by
https://aitalks.sepid.org/
Source palette and design tokens were supplied by the user on 2026-10-27.
This is a slide adaptation, not a claim that the website itself uses these exact slide layouts.
-->

## 1. Design intent

Create clear, modern English-language presentation decks that borrow the visual identity of AI Talks:
- Light, uncluttered canvas
- Green as the primary brand accent
- Strong black headlines and readable dark-gray body text
- Pale-green panels for emphasis
- Rounded cards and restrained borders/shadows
- LTR composition and a clean Latin sans-serif typeface

The result should feel like a polished technology/education presentation, not a screenshot of a website.

## 2. Color tokens

### Core palette

| Token | HEX | Slide role |
|---|---|---|
| `canvas` | `#FFFFFF` | Default slide background |
| `ink` | `#000000` | Main headings and high-priority text |
| `accent` | `#4CAF50` | Brand green, key numbers, emphasis, progress markers |
| `accent-dark` | `#388E3C` | Green text on pale surfaces; stronger emphasis |
| `accent-light` | `#66BB6A` | Secondary green accents and diagrams |
| `accent-soft` | `#E8F5E9` | Highlight panels, quote cards, callouts |
| `accent-pale` | `#C8E6C9` | Light borders, separators, subtle fills |
| `teal` | `#009688` | Secondary data series or supporting concepts |
| `slate` | `#475569` | Secondary text, captions, labels |
| `body` | `#292D32` | Body copy |
| `muted` | `#979797` | Metadata only; avoid for essential text |
| `surface` | `#F7F7F7` | Alternative neutral panel background |
| `border` | `#F0F0F0` | Subtle separators and card borders |
| `danger` | `#F44336` | Errors, risks, negative results |
| `danger-bright` | `#FF3355` | High-priority alert accent; use sparingly |

### Color usage rules

- Use white for most slide backgrounds. Do not alternate randomly between light and dark themes.
- Green is the primary identity color. Use it for one main purpose per slide: headline marker, key statistic, section band, or primary diagram.
- Use pale green behind a short statement, not behind long paragraphs.
- Use teal as a secondary category or data-series color; do not let it compete with green.
- Red is reserved for warnings, risks, failures, or negative comparisons.
- Black is the default title color. Body copy should usually be `#292D32` or `#475569`.
- Do not use `#979797` for small or essential text; contrast may be too low on white.
- Avoid large areas of saturated green with black text unless contrast and visual balance have been checked. Prefer white text on green for compact labels and black/dark text on pale green for large text blocks.
- Keep each slide to white + one main green + neutrals, with at most one supporting accent unless a chart needs more.

## 3. Typography — English / LTR

### Preferred font stack

1. **Inter** — preferred; clean, highly legible, widely available (used by this deck).
2. **Segoe UI** — robust system fallback on Windows.
3. **system-ui** — final fallback for any platform.
4. **Helvetica Neue / Arial** — use if already available in the production environment.

Always test the final file on the presentation computer. If the chosen font is not embedded or installed, PowerPoint may substitute it and change line breaks.

### Type scale for a 16:9 deck

These are slide-design recommendations, not website CSS sizes.

| Element | Recommended size | Weight |
|---|---:|---:|
| Cover title | 36–48 pt | 700–800 |
| Section divider title | 34–44 pt | 700–800 |
| Standard slide title | 28–36 pt | 700 |
| Main takeaway / key statistic | 34–56 pt | 700–800 |
| Card heading | 20–26 pt | 600–700 |
| Body copy | 18–24 pt | 400–500 |
| Chart labels | 16–20 pt | 500 |
| Source / footnote | 10–14 pt | 400 |
| Slide number / metadata | 10–12 pt | 500 |

### Typography rules

- Use a consistent hierarchy; no more than 3–4 distinct text sizes on a typical slide.
- Prefer short sentences and compact bullets over paragraphs.
- Use line-height around 1.35–1.6 for body copy.
- Use weight 700 for titles and 400–500 for body text.
- Avoid very thin font weights for projection.
- Keep text left-aligned with paragraph direction set to LTR.
- Set code, URLs, identifiers, and technical terms in a monospaced font so they stand apart from body copy.
- Do not justify body paragraphs. Left-align them.
- Avoid all-caps English labels as the main headline; small English metadata is acceptable.

## 4. Slide canvas and layout

- Default aspect ratio: **16:9 widescreen**.
- Use a consistent safe margin of roughly 5–7% from the slide edges.
- Establish a stable title zone near the top; align content to a shared grid.
- Prefer a single clear focal point per slide.
- Leave generous whitespace. Do not fill every empty area.
- Use 2-column layouts only when both sides are short and meaningfully comparable.
- The primary reading flow begins at the upper-left and proceeds rightward.
- Put slide number and optional deck/section label in a consistent footer position. A common convention is the section label bottom-left and the slide number bottom-right; choose one convention and keep it stable.
- Keep decorative green rules, corner marks, or small geometric motifs consistent and subtle.

### Spacing scale

Use a 4-unit base grid for design consistency. For a 1920×1080 canvas, these are practical starting values:

`8, 16, 24, 32, 48, 64, 80 px`

Use larger gaps between separate content groups and smaller gaps within a card. Avoid inconsistent one-off spacing.

## 5. Shapes, cards, borders, and shadows

- Preferred card corner radius: 8–12 px in a web-like design system; adapt proportionally to the slide authoring tool.
- Use 16 px radius only for large feature panels or cover elements.
- Use pill shapes for small category labels or status badges, not for every component.
- Prefer a subtle `#F0F0F0` border or pale-green border over heavy outlines.
- Shadows should be restrained and low-contrast. Avoid floating-card effects on every element.
- Use a consistent stroke width for icons and diagrams.
- Prefer simple line icons over emoji in formal or technical decks.
- Do not place body text over busy images. Add a clean surface or overlay if necessary.

## 6. Recommended slide patterns

### A. Cover / title slide
- White canvas.
- Large title aligned left.
- One short subtitle below.
- Use a green block, line, or pale-green shape as the main visual anchor.
- Optional small label such as topic, event, presenter, or date.
- Avoid a wall of logos and multiple competing decorative elements.

### B. Section divider
- Large section number or short label in green.
- One strong title, ideally 3–7 words.
- Pale-green block or simple geometric motif.
- Minimal additional text.

### C. Standard content
- One takeaway-style title at the top.
- 3–5 concise bullets or one compact visual.
- Highlight one key phrase or number in green.
- If the slide requires more than five bullets, split it into multiple slides.

### D. Two-column comparison
- Two aligned cards with equal visual weight.
- Use green for the preferred/current/positive side and neutral colors for the comparison side.
- Use red only for a genuinely negative or risky item.
- Keep the same number of comparison dimensions in both columns when possible.

### E. Process / timeline
- 3–5 steps maximum per slide.
- Use a clear numbered sequence.
- Step 1 begins on the left and progresses rightward.
- Use green for the current or key step, pale green for supporting steps, and thin connectors.

### F. Data / chart
- Use green for the primary series and teal for a secondary series.
- Use slate for labels and grid lines.
- Keep chart backgrounds white.
- Direct-label important values where possible.
- Avoid 3D charts, decorative gradients, and unnecessary legends.
- Use red only when it has semantic meaning, not just to add variety.
- Ensure axes, labels, and legends remain readable on a projector.

### G. Quote / key insight
- Place a short statement in a pale-green panel.
- Use a large quotation mark or slim green accent rule if helpful.
- Keep attribution small but readable.
- Do not use long quotes as a substitute for the slide's own message.

### H. Code / technical slide
- Use a near-white or very light-gray code panel.
- Use a monospaced font for code and preserve LTR direction inside code blocks.
- Limit the code to the smallest useful excerpt.
- Highlight one or two lines with pale green; do not color every token.
- Keep explanatory text outside the code block.

### I. Closing / summary
- Restate 3 key takeaways, or one main conclusion plus a next step.
- Use green to highlight the final message.
- Keep contact details or references in a quiet footer.
- Do not end with a dense list of everything covered.

## 7. Text direction and content rules

- Treat the entire slide as LTR.
- Align titles, body copy, bullets, card text, and labels to the left unless the layout intentionally requires otherwise.
- In diagrams and timelines, arrange the logical sequence from left to right.
- Keep code, URLs, email addresses, file paths, and most technical identifiers in a monospaced font.
- Keep capitalization consistent: sentence case for titles and body copy; capitalize proper nouns and tool names.
- Check punctuation, parentheses, numbers, and slash-separated terms after rendering.
- Keep chart labels short; abbreviate rather than wrap when possible.
- Do not flip logos or symbols that have a fixed orientation.

## 8. Animation and transitions

The design system should support animation without depending on it.

- Use subtle, purposeful reveals: fade, appear, or short directional movement.
- Reveal bullets one at a time only when pacing matters.
- Directional entrance animations should follow the left-to-right reading order.
- Use animation to explain sequence, causality, or a change in state—not as decoration.
- Keep transitions consistent across the deck.
- Avoid bouncing, spinning, excessive zooming, and different transitions on every slide.
- Make the static slide understandable if animations are disabled or lost during export.
- If exporting to PowerPoint, verify which animations survive the export. Web/CSS/Vue animations generally do not automatically become native PowerPoint animations.
- If the presentation must work offline, test all media and fonts on the target computer.

## 9. Accessibility and projection

- Maintain strong text/background contrast.
- Do not encode meaning by color alone; add labels, icons, or text.
- Use body text large enough for a room, typically 18 pt or larger.
- Keep footnotes secondary but not microscopic.
- Avoid long lines of text; use a comfortable line length.
- Ensure important text remains visible in grayscale or for viewers with color-vision deficiencies.
- Test slides at presentation size, not only on a laptop screen.

## 10. Content density rules

- One primary message per slide.
- Use a title that communicates the takeaway, not just a category.
- Aim for 3–5 bullets, with short lines.
- Prefer diagrams, examples, and comparisons over explanatory paragraphs.
- Split dense content into multiple slides instead of shrinking the font.
- Use footnotes for sources and context, not for essential information.
- Use consistent terminology throughout the deck.

## 11. Design tokens for implementation

Framework-agnostic CSS-style tokens:

```css
:root {
  --slide-canvas: #FFFFFF;
  --slide-ink: #000000;
  --slide-body: #292D32;
  --slide-muted: #475569;
  --slide-accent: #4CAF50;
  --slide-accent-dark: #388E3C;
  --slide-accent-light: #66BB6A;
  --slide-accent-soft: #E8F5E9;
  --slide-accent-pale: #C8E6C9;
  --slide-teal: #009688;
  --slide-surface: #F7F7F7;
  --slide-border: #F0F0F0;
  --slide-danger: #F44336;
  --slide-danger-bright: #FF3355;

  --slide-font: "Inter", "Segoe UI", system-ui, sans-serif;

  --slide-radius-card: 8px;
  --slide-radius-panel: 12px;
  --slide-radius-feature: 16px;

  --slide-space-1: 8px;
  --slide-space-2: 16px;
  --slide-space-3: 24px;
  --slide-space-4: 32px;
  --slide-space-5: 48px;
  --slide-space-6: 64px;
}
```

## 12. Quality checklist

Before delivering a deck, check:

- [ ] Text is LTR, punctuation is correct, and capitalization is consistent.
- [ ] Fonts are installed/embedded where possible and do not reflow on the target machine.
- [ ] Every slide has one clear focal point.
- [ ] Main text is readable from a distance.
- [ ] Green is the primary accent; teal and red are used semantically.
- [ ] Cards, margins, title placement, and footers are consistent.
- [ ] Charts have legible labels and do not rely on color alone.
- [ ] Animations are purposeful and not required to understand the slide.
- [ ] PPTX export has been checked in Microsoft PowerPoint or the actual presentation app.
- [ ] Any flattened/image-based slides are understood and accepted if editability matters.
- [ ] Offline playback works and no required media is missing.

## 13. Source and confidence notes

- Source website: https://aitalks.sepid.org/
- Palette, font names, and token data: provided by the user on 2026-10-27.
- The source data identifies `#4CAF50` as the main green, `#E8F5E9` as a pale green, `#009688` as teal, and Peyda as the primary website font.
- Slide sizes, hierarchy, layout recipes, directional guidance, and animation rules in this file are recommendations adapted for presentations, not measured properties of the source website.
- Color-role assignments are inferred from the supplied extraction. Confirm exact font availability, color contrast, and export behavior in the chosen slide tool.
