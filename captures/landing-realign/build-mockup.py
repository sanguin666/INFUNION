"""Builds mockup.html: the English landing page (landing/en/index.html) with
the proposed realignment applied. Changed blocks carry a yellow NEW or
CHANGED tag; open mockup.html?clean to see the page without the tags.
Run from the repo root: python3 captures/landing-realign/build-mockup.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
src = (ROOT / 'landing/en/index.html').read_text()
out = src

def sub(old, new, count=1):
    global out
    assert old in out, old[:80]
    out = out.replace(old, new, count)

def tag(kind):
    return f'<span class="mk-tag mk-{kind.lower()}">{kind}</span>'

# Asset paths and scripts: a static mockup, served from the repo root.
out = out.replace('"/assets/', '"../../landing/assets/')
out = re.sub(r'\s*<script src="[^"]+"></script>', '', out)

# ---- Hero
sub('<p data-i18n="heroSub">Schedules, requests, giving, news: your members have the essentials on their phone. Your team manages everything from a single dashboard, with no technical skills required.</p>',
    '<p data-i18n="heroSub" class="mk">' + tag('CHANGED') + 'Schedules, requests, contributions, news: your members have the essentials on their phone, and anyone can look around without an account. Your team manages everything from a single dashboard, and reaches every member, in the app or not.</p>')

# ---- Why infunion
sub('<h3 data-i18n="why2Title">More regular giving</h3>\n            <p data-i18n="why2Desc">One-off or monthly contributions, campaigns with goal tracking, and a tax receipt issued for every contribution.</p>',
    '<h3 data-i18n="why2Title">Contributions straight to your account</h3>\n            <p data-i18n="why2Desc" class="mk">' + tag('CHANGED') + 'One-off or monthly, in the app or with a pay link and QR code anyone can use: card, Apple Pay or Google Pay, no app or account needed. The money goes straight to your community’s own account, with a tax receipt for every contribution.</p>')
sub('<h3 data-i18n="why3Title">Better-informed members</h3>\n            <p data-i18n="why3Desc">Up-to-date schedules, news and notifications: everyone receives the right information at the right time.</p>',
    '<h3 data-i18n="why3Title">Every member reached</h3>\n            <p data-i18n="why3Desc" class="mk">' + tag('CHANGED') + 'Bring in the member list you already have and write to everyone, in the app or by email. Schedules, news and notifications reach the right people at the right time.</p>')

# ---- Getting started
sub('<p data-i18n="how1Desc">Introduction, schedules, home page: we configure your space alongside you, in a single day.</p>',
    '<p data-i18n="how1Desc" class="mk">' + tag('CHANGED') + 'Introduction, schedules, home page, your member list: we configure your space alongside you, in a single day.</p>')
sub('<p data-i18n="how3Desc">They find your community in the app, nearby, by name or by town, or scan the QR code on the flyer generated from the dashboard.</p>',
    '<p data-i18n="how3Desc" class="mk">' + tag('CHANGED') + 'They get your invitation by email, find you in the app or on your community’s website, or scan the QR code on the flyer generated from the dashboard.</p>')

# ---- Dashboard: home page row, then two new rows and a grid
sub('<p data-i18n="dash2Desc">Important notice, opening hours, giving campaign: build the app\'s home page and see how it looks on a phone in real time.</p>',
    '<p data-i18n="dash2Desc" class="mk">' + tag('CHANGED') + 'Important notice, opening hours, contribution campaign: build the app\'s home page and see how it looks on a phone in real time. Save a version and switch back to it in one click.</p>')
# The three bullets under the home page row move to the new grid.
out = re.sub(r'\s*<ul>\s*<li><span class="check">✓</span> <span data-i18n="dashBullet1">.*?</ul>', '', out, count=1, flags=re.S)

NEW_DASH = '''
        <div class="split dash-row mk mk-block">''' + tag('NEW') + '''
          <div class="split-copy">
            <h3>Write to every member, in the app or not</h3>
            <p>Import the list you already have, from Excel, a CSV file or Google Sheets, and check it before anything is saved. Then invite people to the app, ask for a contribution or send news by email, and see who opened it, joined or contributed.</p>
            <ul>
              <li><span class="check">✓</span> <span>Invitations on every plan, other messages from Essentials</span></li>
              <li><span class="check">✓</span> <span>Each email shows your community’s name and logo</span></li>
              <li><span class="check">✓</span> <span>Anyone can stop the emails in one click</span></li>
            </ul>
          </div>
          <div class="split-media">
            <div class="browser">
              <div class="browser-bar"><span></span><span></span><span></span></div>
              <img src="shots/admin-write.webp" alt="Write to members" loading="lazy" width="1440" height="900" />
            </div>
          </div>
        </div>
        <div class="split split-reverse dash-row mk mk-block">''' + tag('NEW') + '''
          <div class="split-media mk-pay">
            <div class="phone phone-sm"><div class="phone-screen"><img src="shots/pay.webp" alt="A pay link opened on a phone" loading="lazy" width="390" height="844" /></div></div>
          </div>
          <div class="split-copy">
            <h3>A pay link and a QR code for every occasion</h3>
            <p>Create a link for a fee, a trip or a project, with a fixed amount or a free one and a last day if you want. Share it or print its poster: people pay by card, Apple Pay or Google Pay, without the app and without an account.</p>
            <ul>
              <li><span class="check">✓</span> <span>Paid straight into your community’s own account</span></li>
              <li><span class="check">✓</span> <span>Totals for each link in the dashboard</span></li>
              <li><span class="check">✓</span> <span>Available from the free Basic plan</span></li>
            </ul>
          </div>
        </div>
        <div class="split dash-row mk mk-block">''' + tag('NEW') + '''
          <div class="split-copy">
            <h3>Your community’s website, ready-made</h3>
            <p>Switch it on and share the link: news, the weekly timetable, campaigns and the map, built from what you already keep up to date in the app. Visitors are invited to join you in the app.</p>
          </div>
          <div class="split-media">
            <div class="browser">
              <div class="browser-bar"><span></span><span></span><span></span></div>
              <img src="shots/site.webp" alt="A community website" loading="lazy" width="1440" height="900" />
            </div>
          </div>
        </div>
        <div class="mk mk-block mk-grid-wrap">''' + tag('NEW') + '''
          <h3 class="mk-grid-title">Also in the dashboard</h3>
          <div class="mk-grid">
            <div><strong>An AI assistant for your team</strong><span>Ask how to do something in the dashboard and get a short answer with a link to the right page. On every plan.</span></div>
            <div><strong>Undo, and saved versions</strong><span>Deleted something by mistake? Undo it. Keep versions of your home page and switch back in one click.</span></div>
            <div><strong>Several communities, one account</strong><span>Move from one community to another without signing in again.</span></div>
            <div><strong>Seven languages</strong><span>English, Spanish, Catalan, Valencian, Galician, Portuguese and French, for the team and for members.</span></div>
            <div><strong>A flyer with a QR code</strong><span>Ready to print, in your community’s language.</span></div>
            <div><strong>Personal data under control</strong><span>Members download their data or delete their account themselves. You can export everything at any time.</span></div>
          </div>
        </div>
      </div>
    </section>

    <section id="features"'''
sub('''
      </div>
    </section>

    <section id="features"''', NEW_DASH)

# ---- Modules: Donate card
sub('<p data-i18n="modDonationsDesc">Membership fees, one-off or regular contributions, and campaigns with goal tracking. A receipt or tax certificate for every payment.</p>',
    '<p data-i18n="modDonationsDesc" class="mk">' + tag('CHANGED') + 'Membership fees, one-off or monthly contributions, campaigns with goal tracking and pay links with their own QR code. Card, Apple Pay or Google Pay, and a receipt or tax certificate for every payment.</p>')

# ---- App section: three member-side cards before the note
APP_CARDS = '''<div class="feature-grid why-grid mk mk-block mk-app">''' + tag('NEW') + '''
          <div class="feature-card"><h3>Look around first</h3><p>Anyone can open your community and turn on notifications without an account. They sign in, with no password, only to make a request or contribute.</p></div>
          <div class="feature-card"><h3>In each member’s language</h3><p>Posts and the home page can be translated automatically into the language each member reads. Complete plan.</p></div>
          <div class="feature-card"><h3>Answers at any hour</h3><p>An AI assistant answers members’ questions about the community: times, how to sign up, where to go. Complete plan.</p></div>
        </div>
        <p class="app-note"'''
sub('<p class="app-note"', APP_CARDS)
sub('<p class="app-note" data-i18n="appNote">Sign in with an email or phone number, no password · Notifications and reminders · App available in seven languages</p>',
    '<p class="app-note" data-i18n="appNote">Sign in with an email or phone number, no password · Notifications and reminders · App available in seven languages</p>')

# ---- Pricing
sub('<li><span class="check">✓</span> <span data-i18n="pricingFree4">The QR code and its printable flyer</span></li>',
    '<li><span class="check">✓</span> <span data-i18n="pricingFree4">The QR code and its printable flyer</span></li>\n            <li class="mk">' + tag('NEW') + '<span class="check">✓</span> <span>Pay links and QR codes: card, Apple Pay, Google Pay</span></li>\n            <li class="mk">' + tag('NEW') + '<span class="check">✓</span> <span>Your community’s website</span></li>\n            <li class="mk">' + tag('NEW') + '<span class="check">✓</span> <span>Import your member list and invite them by email</span></li>')
sub('<li><span class="check">✓</span> <span data-i18n="pricingEss2">All the modules your community needs day to day</span></li>',
    '<li><span class="check">✓</span> <span data-i18n="pricingEss2">All the modules your community needs day to day</span></li>\n            <li class="mk">' + tag('NEW') + '<span class="check">✓</span> <span>Write to all your members by email, in the app or not</span></li>')
sub('<li><span class="check">✓</span> <span data-i18n="pricingComp3">An AI assistant for your team (coming soon)</span></li>',
    '<li class="mk">' + tag('CHANGED') + '<span class="check">✓</span> <span>Posts translated automatically into each member’s language</span></li>\n            <li class="mk">' + tag('CHANGED') + '<span class="check">✓</span> <span>An AI assistant that answers members’ questions</span></li>')

# ---- FAQ
sub('<summary data-i18n="faq4Q">Where is our data hosted?</summary>\n            <p data-i18n="faq4A">On servers located in Europe.</p>',
    '<summary data-i18n="faq4Q">Where is our data hosted, and how is it protected?</summary>\n            <p data-i18n="faq4A" class="mk">' + tag('CHANGED') + 'On servers located in Europe, in line with the GDPR. Members give their consent when they join, can download their data and delete their account from the app, and you can export all your community’s data at any time.</p>')
sub('<p data-i18n="faq5A">They simply sign in with their email or phone number, with no password to remember.</p>',
    '<p data-i18n="faq5A" class="mk">' + tag('CHANGED') + 'No. They can look around and get notifications without an account. To make a request or contribute, they sign in with their email or phone number, with no password to remember.</p>')
sub('<summary data-i18n="faq6Q">Is infunion suitable for communities that are not churches?</summary>\n            <p data-i18n="faq6A">Yes. infunion is designed for any community: you switch on only the modules you need, and we develop new ones around your needs.</p>',
    '<summary data-i18n="faq6Q">Which communities is infunion for?</summary>\n            <p data-i18n="faq6A" class="mk">' + tag('CHANGED') + 'Every kind: associations, clubs, cultural and sports groups, places of worship. You switch on only the modules you need, and we develop new ones around your needs.</p>\n          </details>\n          <details open class="mk">' + tag('NEW') + '\n            <summary>How do contributions reach us?</summary>\n            <p>Straight into your community’s own Stripe account, then to your bank. Members pay in the app or through your pay links, by card, Apple Pay or Google Pay.</p>')

# ---- Search description (not visible): plans replaced à la carte modules
out = out.replace('Free Basic plan, paid modules à la carte.', 'Free Basic plan, Essentials and Complete plans.')

STYLE = '''
  <style>
    .mk { position: relative; }
    .mk-block { outline: 2px dashed #F9B800; outline-offset: 10px; border-radius: 4px; }
    p.mk, li.mk, details.mk { background: #FFF6D6; border-radius: 6px; box-shadow: 0 0 0 4px #FFF6D6; }
    .mk-tag { display: inline-block; font: 800 10px/1 Nunito, sans-serif; letter-spacing: .06em; padding: 3px 6px; border-radius: 4px; margin-right: 6px; vertical-align: 2px; color: #2B2724; background: #F9B800; }
    .mk-block > .mk-tag { position: absolute; top: -20px; left: -6px; z-index: 2; }
    .mk-changed { background: #FFE38A; }
    .mk-pay { display: flex; justify-content: center; }
    .mk-grid-wrap { margin-top: 56px; }
    .mk-grid-title { font-size: 22px; font-weight: 800; margin: 0 0 18px; text-align: center; }
    .mk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .mk-grid > div { background: #fff; border: 1px solid #E7E3F3; border-radius: 14px; padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; }
    .mk-grid strong { font-size: 16px; }
    .mk-grid span { color: var(--text-muted, #6b6577); font-size: 14.5px; line-height: 1.5; }
    .mk-app { margin: 48px 0 8px; }
    @media (max-width: 860px) { .mk-grid { grid-template-columns: 1fr; } }
    body.clean .mk-tag { display: none; }
    body.clean .mk-block { outline: none; }
    body.clean p.mk, body.clean li.mk, body.clean details.mk { background: none; box-shadow: none; }
  </style>
  <script>if (location.search.indexOf('clean') >= 0) document.addEventListener('DOMContentLoaded', function () { document.body.classList.add('clean'); });</script>
</head>'''
out = out.replace('</head>', STYLE, 1)
out = out.replace('<title>', '<title>MOCKUP · ', 1)

out = out.replace(' loading="lazy"', '')
out = out.replace('<option value="en">', '<option value="en" selected>')
(pathlib.Path(__file__).parent / 'mockup.html').write_text(out)
print('wrote mockup.html')
