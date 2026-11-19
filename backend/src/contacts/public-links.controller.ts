import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { OutreachService } from './outreach.service.js';
import { OutreachKind } from './entities/outreach.entity.js';
import { outreachText, fill, type OutreachText } from './outreach-texts.js';
import { publicPage, escapeHtml } from './pages.js';
import { DonationsService, type BizumStart } from '../donations/donations.service.js';
import { StripeService } from '../donations/stripe.service.js';
import { DonationPurpose } from '../donations/entities/donation.entity.js';
import { returnUrlBase } from '../donations/donations.controller.js';
import { PaymentLinksService, linkOpen, todayInMadrid } from '../donations/payment-links.service.js';
import type { PaymentLink } from '../donations/entities/payment-link.entity.js';
import { payoutsReady } from '../donations/payouts-account.js';
import type { Poi } from '../pois/entities/poi.entity.js';
import type { DonationCampaign } from '../donations/entities/donation-campaign.entity.js';

const AMOUNTS = [5, 10, 20, 50];

function amountOf(body: Record<string, unknown>): number | null {
  // A typed amount wins over a chip: typing clears the chips, so a
  // filled box is what the payer meant.
  const typed = String(body.other ?? '').trim();
  const raw = typed || String(body.amount ?? '');
  const amount = Number(raw.replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return null;
  return Math.round(amount * 100) / 100;
}

/** "15,00 €" in the page's language. */
function formatEuros(amount: number, lang: string): string {
  const locale = lang === 'va' || lang === 'ca' ? 'ca-ES' : lang === 'pt' ? 'pt-PT' : lang === 'en' ? 'en-IE' : lang;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
}

/** A suggested amount from a pay link's ?amount=, if it is a sensible one. */
function presetAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const amount = Number(raw.replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return null;
  return Math.round(amount * 100) / 100;
}

/**
 * The links in a community's emails to its members (no sign-in: the link
 * itself says who it is for). A button click is counted, then leads on:
 * an invitation to the landing page's "join" section with the
 * community's code, a contribution request to a page where they give by
 * card. "Stop these emails" asks once, then never writes again.
 */
@Controller('m')
export class PublicLinksController {
  constructor(
    private readonly outreach: OutreachService,
    private readonly donations: DonationsService,
    private readonly stripe: StripeService,
    private readonly paymentLinks: PaymentLinksService,
    private readonly config: ConfigService,
  ) {}

  @Get('done/:lang')
  @Header('Content-Type', 'text/html; charset=utf-8')
  done(@Param('lang') lang: string, @Query('status') status?: string): string {
    const words = outreachText(lang);
    const cancelled = status === 'cancelled';
    return publicPage({
      lang,
      title: cancelled ? words.cancelledTitle : words.thanksTitle,
      body: `<p>${escapeHtml(cancelled ? words.cancelledText : words.thanksText)}</p>`,
    });
  }

  /**
   * "I don't want to receive these emails" (Seb, 10 Nov 2026), from the
   * foot of every email a community sends. Stops that community's emails
   * only; "I changed my mind" undoes it.
   */
  @Get('stop/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async stopPage(@Param('token') token: string): Promise<string> {
    const contact = await this.outreach.findByToken(token);
    if (!contact) return this.gone('en');
    const lang = contact.language ?? contact.poi.language;
    const words = outreachText(lang);
    if (contact.unsubscribedAt) return this.stopped(words, lang, contact.poi, token);
    return publicPage({
      lang,
      title: words.stopTitle,
      community: contact.poi.name,
      logoUrl: contact.poi.logoUrl,
      body: `<p>${escapeHtml(fill(words.stopText, { community: contact.poi.name }))}</p>
<form method="post" action="/m/stop/${escapeHtml(token)}"><button type="submit">${escapeHtml(words.stopButton)}</button></form>
<p class="link-row"><a href="/m/stop/${escapeHtml(token)}/keep">${escapeHtml(words.stopKeep)}</a></p>`,
    });
  }

  // The page's button, and mail apps' one-click "Unsubscribe" (RFC 8058).
  @Post('stop/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async stop(@Param('token') token: string): Promise<string> {
    const contact = await this.outreach.stop(token);
    if (!contact) return this.gone('en');
    const lang = contact.language ?? contact.poi.language;
    return this.stopped(outreachText(lang), lang, contact.poi, token);
  }

  /** "Keep receiving them": nothing changes. */
  @Get('stop/:token/keep')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async keep(@Param('token') token: string): Promise<string> {
    const contact = await this.outreach.findByToken(token);
    if (!contact) return this.gone('en');
    const lang = contact.language ?? contact.poi.language;
    const words = outreachText(lang);
    return publicPage({
      lang,
      title: words.keptTitle,
      community: contact.poi.name,
      logoUrl: contact.poi.logoUrl,
      body: `<p>${escapeHtml(fill(words.keptText, { community: contact.poi.name }))}</p>`,
    });
  }

  /** "I changed my mind": the community may email them again. */
  @Post('stop/:token/resume')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async resume(@Param('token') token: string): Promise<string> {
    const contact = await this.outreach.resume(token);
    if (!contact) return this.gone('en');
    const lang = contact.language ?? contact.poi.language;
    const words = outreachText(lang);
    return publicPage({
      lang,
      title: words.resumedTitle,
      community: contact.poi.name,
      logoUrl: contact.poi.logoUrl,
      body: `<p>${escapeHtml(fill(words.resumedText, { community: contact.poi.name }))}</p>`,
    });
  }

  /** "Send me a test": the button leads where the real one will, for nobody. */
  @Get('test/:poiId/:kind')
  @Header('Cache-Control', 'no-store')
  async test(
    @Param('poiId') poiId: string,
    @Param('kind') kind: string,
    @Query('campaign') campaignId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const poi = await this.outreach.findPoiPublic(poiId);
    if (!poi) {
      res.type('html').send(this.gone('en'));
      return;
    }
    if (kind === OutreachKind.CONTRIBUTION) {
      const campaign = await this.outreach.findCampaign(poi.id, campaignId);
      res.type('html').send(this.givePage(poi, poi.language, campaign, null, `/m/test-give/${poi.id}${campaign ? `?campaign=${campaign.id}` : ''}`));
      return;
    }
    res.redirect(302, this.outreach.landingJoinUrl(poi));
  }

  @Post('test-give/:poiId')
  async testGive(
    @Param('poiId') poiId: string,
    @Query('campaign') campaignId: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const poi = await this.outreach.findPoiPublic(poiId);
    if (!poi) {
      res.type('html').send(this.gone('en'));
      return;
    }
    const campaign = await this.outreach.findCampaign(poi.id, campaignId);
    await this.checkout(poi, poi.language, campaign, null, body, req, res);
  }

  @Get('give/:recipientId')
  @Header('Cache-Control', 'no-store')
  async givePageFor(@Param('recipientId') recipientId: string, @Res() res: Response): Promise<void> {
    const recipient = await this.outreach.findRecipient(recipientId);
    if (!recipient) {
      res.type('html').send(this.gone('en'));
      return;
    }
    const poi = recipient.outreach.poi;
    const lang = recipient.contact.language ?? poi.language;
    const campaign = await this.outreach.findCampaign(poi.id, recipient.outreach.campaignId);
    const name = [recipient.contact.firstName, recipient.contact.lastName].filter(Boolean).join(' ');
    res.type('html').send(this.givePage(poi, lang, campaign, name, `/m/give/${recipient.id}`));
  }

  @Post('give/:recipientId')
  async give(
    @Param('recipientId') recipientId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const recipient = await this.outreach.findRecipient(recipientId);
    if (!recipient) {
      res.type('html').send(this.gone('en'));
      return;
    }
    const poi = recipient.outreach.poi;
    const lang = recipient.contact.language ?? poi.language;
    const campaign = await this.outreach.findCampaign(poi.id, recipient.outreach.campaignId);
    await this.checkout(poi, lang, campaign, recipient.contact.id, body, req, res);
  }

  /**
   * A payment link, the one behind a shared or printed QR code (Seb,
   * 10 Nov 2026): anyone can open it, no sign-in, and pay by card,
   * Apple Pay or Google Pay on Stripe's page. The first, simpler links
   * named the community itself (/m/pay/<community id>): those lead to the
   * community's own "Contribute" link, so printed QR codes keep working.
   */
  @Get('pay/:key')
  @Header('Cache-Control', 'no-store')
  async payPage(
    @Param('key') key: string,
    @Query('amount') amount: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (/^[0-9a-f-]{36}$/i.test(key)) {
      const poi = await this.payablePoi(key);
      if (!poi) {
        res.type('html').send(this.gone('en'));
        return;
      }
      const link = await this.paymentLinks.ensureDefault(poi.id);
      const preset = presetAmount(amount);
      res.redirect(302, `/m/pay/${link.code}${preset ? `?amount=${preset}` : ''}`);
      return;
    }
    const found = await this.payableLink(key);
    if (!found) {
      res.type('html').send(await this.linkGone(key));
      return;
    }
    const { link, poi } = found;
    res.type('html').send(
      this.givePage(poi, poi.language, link.campaign ?? null, null, `/m/pay/${link.code}`, presetAmount(amount), {
        title: link.title,
        intro: link.message ?? undefined,
        fixed: link.amount ?? null,
        askName: link.askName,
      }),
    );
  }

  @Post('pay/:key')
  async pay(
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const found = await this.payableLink(key);
    if (!found) {
      res.type('html').send(await this.linkGone(key));
      return;
    }
    const { link, poi } = found;
    await this.checkout(poi, poi.language, link.campaign ?? null, null, body, req, res, link);
  }

  /** The payer says their Bizum is sent: the team is asked to confirm it. */
  @Post('bizum/:poiId/:donationId/sent')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async bizumSent(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Param('donationId', ParseUUIDPipe) donationId: string,
    @Query('lang') langParam: string | undefined,
  ): Promise<string> {
    const poi = await this.outreach.findPoiPublic(poiId);
    const lang = langParam ?? poi?.language ?? 'en';
    if (!poi) return this.gone(lang);
    const words = outreachText(lang);
    let sent: { code: string; amount: number };
    try {
      sent = await this.donations.markBizumSent(poiId, donationId);
    } catch {
      return this.gone(lang);
    }
    return publicPage({
      lang,
      title: words.bizumThanksTitle,
      community: poi.name,
      logoUrl: poi.logoUrl,
      body: `<p>${escapeHtml(fill(words.bizumThanksText, { amount: formatEuros(sent.amount, lang), community: poi.name }))}</p>
<p class="waiting">${escapeHtml(words.bizumWaiting)} · <b>${escapeHtml(sent.code)}</b></p>`,
    });
  }

  /** An email's button. Last, so the named routes above win. */
  @Get(':recipientId')
  @Header('Cache-Control', 'no-store')
  async click(@Param('recipientId') recipientId: string, @Res() res: Response): Promise<void> {
    const found = await this.outreach.click(recipientId);
    if (!found) {
      res.type('html').send(this.gone('en'));
      return;
    }
    if (found.recipient.outreach.kind === OutreachKind.CONTRIBUTION) {
      res.redirect(302, `/m/give/${found.recipient.id}`);
      return;
    }
    res.redirect(302, this.outreach.landingJoinUrl(found.poi));
  }

  // ---- Pages ----

  /** The community, if it takes payments right now. */
  private async payablePoi(poiId: string): Promise<Poi | null> {
    const poi = await this.outreach.findPoiPublic(poiId);
    if (!poi || poi.closingRequestedAt || poi.closedAt) return null;
    // A Bizum number is a way to pay too (Seb, 16 Nov 2026).
    return payoutsReady(poi, this.stripe.isConfigured) || poi.bizumPhone ? poi : null;
  }

  /** "This link no longer works", in its community's language when known. */
  private async linkGone(code: string): Promise<string> {
    const link = await this.paymentLinks.findByCode(code);
    return this.gone(link?.poi.language ?? 'en');
  }

  /** A payment link that takes payments right now, with its community. */
  private async payableLink(code: string): Promise<{ link: PaymentLink; poi: Poi } | null> {
    const link = await this.paymentLinks.findByCode(code);
    if (!link || !linkOpen(link, todayInMadrid())) return null;
    // A project that has ended takes no more contributions.
    if (link.campaign && !link.campaign.active) return null;
    const poi = await this.payablePoi(link.poi.id);
    return poi ? { link, poi } : null;
  }

  private async checkout(
    poi: Poi,
    lang: string,
    campaign: DonationCampaign | null,
    contactId: string | null,
    body: Record<string, unknown>,
    req: Request,
    res: Response,
    link: PaymentLink | null = null,
  ): Promise<void> {
    // A fixed amount is the link's, whatever the form sends.
    const amount = link?.amount ?? amountOf(body);
    const back = req.originalUrl;
    if (!amount) {
      res.redirect(303, back);
      return;
    }
    const donorName = link && !link.askName ? undefined : String(body.name ?? '').trim().slice(0, 80) || undefined;
    const gift = {
      amount,
      donorName,
      purpose: campaign ? DonationPurpose.CAMPAIGN : DonationPurpose.GENERAL,
      ...(campaign ? { campaignId: campaign.id } : {}),
    };
    const giftOptions = {
      ...(contactId ? { contactId } : {}),
      ...(link ? { paymentLinkId: link.id } : {}),
    };
    // Bizum to the community's own number (Seb, 16 Nov 2026): the payer
    // gets the number, the amount and the concept to write.
    const card = payoutsReady(poi, this.stripe.isConfigured);
    if (poi.bizumPhone && (body.method === 'bizum' || !card)) {
      const bizum = await this.donations.startBizum(poi.id, gift, giftOptions);
      res.type('html').send(this.bizumPage(poi, lang, bizum));
      return;
    }
    const result = await this.donations.startCheckout(
      poi.id,
      gift,
      returnUrlBase(this.config, req),
      {
        ...giftOptions,
        // A named link reads as itself on Stripe's page ("Christmas lunch — Carmen").
        ...(link && !link.isDefault ? { productName: `${link.title} — ${poi.name}`.slice(0, 250) } : {}),
        returnPath: `/m/done/${encodeURIComponent(lang)}`,
      },
    );
    if (result.mode === 'stripe') res.redirect(303, result.checkoutUrl);
    else res.redirect(303, `/m/done/${encodeURIComponent(lang)}?status=success`);
  }

  private givePage(
    poi: Poi,
    lang: string,
    campaign: DonationCampaign | null,
    name: string | null,
    action: string,
    preset: number | null = null,
    options: { title?: string; intro?: string; fixed?: number | null; askName?: boolean } = {},
  ): string {
    const words = outreachText(lang);
    const fixed = options.fixed ?? null;
    const askName = options.askName ?? true;
    const paymentsLive = this.stripe.isConfigured;
    const card = payoutsReady(poi, paymentsLive);
    const bizum = !!poi.bizumPhone;
    const buttons = [
      card ? `<button type="submit" name="method" value="card">${escapeHtml(words.giveButton)}</button>` : '',
      bizum
        ? `<button type="submit" name="method" value="bizum"${card ? ' class="alt"' : ''}>${escapeHtml(words.bizumButton)} <span class="bizum-tag">bizum</span></button>`
        : '',
      card ? `<p class="small">${escapeHtml(paymentsLive ? words.giveSecure : words.giveDemo)}</p>` : '',
    ].join('\n');
    const presetIsChip = preset !== null && AMOUNTS.includes(preset);
    const checkedChip = preset === null ? 10 : presetIsChip ? preset : null;
    const otherValue = preset !== null && !presetIsChip ? String(preset) : '';
    const chips = AMOUNTS.map(
      (a) =>
        `<label><input type="radio" name="amount" value="${a}"${a === checkedChip ? ' checked' : ''} onchange="document.getElementById('other').value=''">${a} €</label>`,
    ).join('');
    const amountBlock =
      fixed !== null
        ? `<p class="fixed">${escapeHtml(formatEuros(fixed, lang))}</p>`
        : `<label style="margin-top:8px">${escapeHtml(words.giveAmount)}</label>
<div class="amounts">${chips}<input class="other" id="other" name="other" inputmode="decimal" aria-label="${escapeHtml(words.giveOther)} (€)" placeholder="${escapeHtml(words.giveOther)}" value="${escapeHtml(otherValue)}" oninput="if(this.value)document.querySelectorAll('.amounts input[type=radio]').forEach(function(r){r.checked=false})"></div>
`;
    const nameBlock = askName
      ? `<label for="name">${escapeHtml(words.giveName)}</label>
<input id="name" name="name" maxlength="80" value="${escapeHtml(name ?? '')}" autocomplete="name">
`
      : '';
    return publicPage({
      lang,
      title: options.title ?? fill(words.giveTitle, { community: poi.name }),
      community: poi.name,
      logoUrl: poi.logoUrl,
      body: `<p>${escapeHtml(options.intro ?? (campaign ? fill(words.giveProject, { project: campaign.title }) : words.giveIntro))}</p>
<form method="post" action="${escapeHtml(action)}">
${amountBlock}${nameBlock}${buttons}
</form>`,
    });
  }

  /** The steps to send a Bizum by hand, then "I've sent it". */
  private bizumPage(poi: Poi, lang: string, bizum: BizumStart): string {
    const words = outreachText(lang);
    const amount = formatEuros(bizum.amount, lang);
    const copy = (value: string) =>
      `<button type="button" class="copy" onclick="navigator.clipboard&&navigator.clipboard.writeText('${escapeHtml(value.replace(/\s/g, ''))}');this.textContent='${escapeHtml(words.copied).replace(/'/g, '&#39;')}'">${escapeHtml(words.copy)}</button>`;
    return publicPage({
      lang,
      title: fill(words.bizumTitle, { amount }),
      community: poi.name,
      logoUrl: poi.logoUrl,
      body: `<ol class="steps">
<li><span class="n">1</span><div>${escapeHtml(words.bizumStep1)}</div></li>
<li><span class="n">2</span><div><div class="k">${escapeHtml(words.bizumSendTo)}</div><div class="v">${escapeHtml(bizum.phone)} ${copy(bizum.phone)}</div><div class="k">${escapeHtml(poi.name)}</div></div></li>
<li><span class="n">3</span><div><div class="k">${escapeHtml(words.bizumAmount)}</div><div class="v">${escapeHtml(amount)}</div></div></li>
<li><span class="n">4</span><div><div class="k">${escapeHtml(words.bizumConcept)}</div><div class="v">${escapeHtml(bizum.code)} ${copy(bizum.code)}</div><div class="k">${escapeHtml(words.bizumConceptWhy)}</div></div></li>
</ol>
<form method="post" action="/m/bizum/${escapeHtml(poi.id)}/${escapeHtml(bizum.donationId)}/sent?lang=${encodeURIComponent(lang)}">
<button type="submit">${escapeHtml(words.bizumSent)}</button>
</form>`,
    });
  }

  private stopped(words: OutreachText, lang: string, poi: Poi, token: string): string {
    return publicPage({
      lang,
      title: words.stoppedTitle,
      community: poi.name,
      logoUrl: poi.logoUrl,
      body: `<p>${escapeHtml(fill(words.stoppedText, { community: poi.name }))}</p>
<p class="note">${escapeHtml(words.stoppedApp)}</p>
<form method="post" action="/m/stop/${escapeHtml(token)}/resume"><button type="submit" class="alt">${escapeHtml(words.resumeButton)}</button></form>`,
    });
  }

  private gone(lang: string): string {
    const words = outreachText(lang);
    return publicPage({ lang, title: words.goneTitle, body: `<p>${escapeHtml(words.goneText)}</p>` });
  }
}
