# infunion logo kit

Seb's logo kit of 3 November 2026. Slogan: **La unión que te hace comunidad**.

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| Purple | `#6C4FD9` | "fun" and the left ring |
| Yellow | `#F9B800` | the right ring and the line under "union" |
| Ink | `#1D1A2D` | the other letters |
| Light purple | `#A895F2` | "fun" and the left ring, on dark backgrounds only |

## Type

Montserrat Bold for the wordmark (already outlined in the SVGs), Montserrat Medium for the slogan. Both from Google Fonts, under the free OFL licence.

## Folders

- `svg/` master vector files, for print and designers. `on-dark` is for dark backgrounds, `on-purple` for the brand purple, `slogan` adds the slogan under the logo.
- `presentations/` 3000 px PNGs with a transparent background, for PowerPoint, Keynote and Google Slides (the SVGs work too in PowerPoint 365).
- `email/` PNGs on white (safe in dark mode). Show `email-signature-logo.png` at 220 px wide and `newsletter-header.png` at 600 px. `email-signature.html` is a signature template.
- `web/` favicons, touch and PWA icons, the 1200 × 630 share image and `head-snippet.html` with the `<head>` tags.
- `app/` the phone app icon (purple tile, white and yellow rings) and the Android adaptive layers.

## Use

Keep clear space around the logo at least the height of the "n". Smallest size: 120 px wide on screen; below that, use the rings alone. Never change the colours, stretch the logo or add shadows.

In code, the logo lives in `app/src/components/Logo.tsx` and `admin/src/components/LogoMark.tsx`, drawn from `brandArt.ts` (the wordmark outlines from `svg/infunion-logo.svg`).
