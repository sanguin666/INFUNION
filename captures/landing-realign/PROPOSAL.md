# Landing page realignment: proposal

Status: approved by Seb on 11 Nov 2026 with the default answers (all three rows kept, Basic lists import and invitations, pay page and website shown in each landing language). Implemented in `landing/` in the same PR.

The landing page still describes the product as it was at the end of October. Since then infunion has shipped pay links with QR codes, contributions paid straight to each community's Stripe account, guest access, member import and Write to members, automatic translation, the member and team AI assistants, undo and home page versions, a website for each community and GDPR self-service. The landing mentions almost none of it, and the Complete card still says the team assistant is "coming soon" although it is live on every plan.

## Files

- `mockup.html`: the English page with every proposed change. Yellow tags mark what is NEW or CHANGED; `mockup.html?clean` shows it without tags. Built by `build-mockup.py` from `landing/en/index.html`.
- `proposed-desktop.jpg`, `proposed-phone.jpg`: full page, annotated (1280 px and 390 px).
- `proposed-desktop-clean.jpg`, `proposed-phone-clean.jpg`: the same without tags.
- `current-desktop.jpg`, `current-phone.jpg`: today's English page, for comparison.
- `shots/`: new screenshots used by the mockup (Write to members, pay page, community website).

## Changes, section by section

| Section | Today | Proposed |
|---|---|---|
| Hero text | "Schedules, requests, giving, news…" | "contributions" instead of "giving"; members can look around without an account; the team reaches every member, in the app or not. |
| Why infunion, card 2 | "More regular giving" | "Contributions straight to your account": app or pay link and QR, card, Apple Pay, Google Pay, no app or account needed, money goes to the community's own account. |
| Why infunion, card 3 | "Better-informed members" | "Every member reached": import the list you already have and write to everyone. |
| Getting started 1 and 3 | Set-up; members find you in the app or by QR | Set-up includes the member list; members also come from the email invitation and the community website. |
| Dashboard, home page row | Live preview | Adds saved versions you can switch back to. |
| Dashboard, NEW row | (none) | Write to every member, in the app or not: import (Excel, CSV, Google Sheets), invite, ask for a contribution, news; opened, joined, contributed. Screenshot: Write to members. |
| Dashboard, NEW row | (none) | A pay link and a QR code for every occasion: fixed or free amount, last day, poster, card, Apple Pay, Google Pay, totals per link. Screenshot: the pay page on a phone. |
| Dashboard, NEW row | (none) | Your community's website, ready-made. Screenshot: Crecer Juntos' public site. |
| Dashboard, NEW grid | 3 bullets (several communities, 7 languages, flyer) | "Also in the dashboard", 6 cards: AI assistant for the team (every plan), undo and saved versions, several communities, seven languages, QR flyer, personal data under control. |
| Modules, Donate card | Fees, contributions, campaigns, receipts | Adds pay links with their own QR code, card, Apple Pay, Google Pay. |
| For members, NEW cards | (none) | Look around first (guest access), In each member's language (auto translation, Complete), Answers at any hour (member assistant, Complete). |
| Pricing, Basic | 4 lines | Adds pay links and QR codes, the community website, member import and email invitations. |
| Pricing, Essentials | 2 lines | Adds writing to all members by email. |
| Pricing, Complete | "An AI assistant for your team (coming soon)" | Replaced by automatic translation and the member assistant (the team assistant moves to the dashboard grid, since it is on every plan). |
| FAQ, hosting | "On servers located in Europe." | Europe and GDPR: consent, members download their data and delete their account, the community exports everything. |
| FAQ, accounts | Sign in, no password | No account needed to look around; sign in only to make a request or contribute. |
| FAQ, kinds of community | "…communities that are not churches?" | "Which communities is infunion for?", neutral list of kinds. |
| FAQ, NEW | (none) | "How do contributions reach us?": the community's own Stripe account, card, Apple Pay, Google Pay. infunion's fee stays out of the landing, as today. |
| Search description (hidden) | "paid modules à la carte" | "Essentials and Complete plans" (plans replaced à la carte modules on 29 Oct). |

Everything else stays as it is: hero headline and slogan, prices, the three plan cards, the team section, no dark mode.

## Questions for Seb

1. Three new dashboard rows plus a grid make the page about 30 % longer on desktop. Keep all three rows, or fold the website into the grid?
2. Should Basic really list member import and invitations? The code allows invitations on every plan (1,000 emails a month); other messages need Essentials.
3. Show the pay page and the website in the community's own language (Spanish, as in the mockup), or in the page's language for each landing language?

## App screenshots that still show old words

- Donate screen (`donate.webp`, all 7 languages, both variants): the app still titles it "Contribute" and the tab reads "Contri…", while the landing and the admin call the module "Donate". The text also says "this gift costs you €2" ("gift" rather than "contribution") and the button says "Donate €10". The app's texts decide this (`app/src/i18n/translations.ts`: `donationsLabel`, `giveTitle`, `give`, `go_donations`); once the app wording is settled, retake `donate.webp`.
- Home screens in non-Spanish languages show the community's Spanish texts. With automatic translation live, they could show the translated home page.
- Not a landing screenshot, but seen while capturing: the admin Community website page of an association (Crecer Juntos) offers the part "Next Mass and Open now" (`admin/src/i18n/translations.ts`, `part_badges`), which is not neutral.
- The mockup's new screenshots were taken on the local machine, which lacks the admin's font. The final ones will be retaken in all seven languages with the usual setup.

## After approval

1. Move the texts into `landing/assets/i18n.js` for all seven languages (es, en, fr, ca, va, gl, pt), in the template `landing/tools/template.html`, with the worship and association variants.
2. Retake the new screenshots per language into `landing/assets/screens/<lang>/`.
3. Run `node landing/tools/build-languages.js` and bump `ASSET_VERSION` (`?v=`).
4. PR to dev, then staging and production on Seb's "prod".
