import { Body, Controller, Get, Header, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { OutreachService } from './outreach.service.js';
import { OutreachKind } from './entities/outreach.entity.js';
import { outreachText, fill, type OutreachText } from './outreach-texts.js';
import { publicPage, escapeHtml } from './pages.js';
import { DonationsService } from '../donations/donations.service.js';
import { StripeService } from '../donations/stripe.service.js';
import { DonationPurpose } from '../donations/entities/donation.entity.js';
import { returnUrlBase } from '../donations/donations.controller.js';
import { payoutsReady } from '../donations/payouts-account.js';
import type { Poi } from '../pois/entities/poi.entity.js';
import type { DonationCampaign } from '../donations/entities/donation-campaign.entity.js';

const AMOUNTS = [5, 10, 20, 50];

function amountOf(body: Record<string, unknown>): number | null {
  const chosen = String(body.amount ?? '');
  const raw = chosen === 'other' ? String(body.other ?? '') : chosen;
  const amount = Number(raw.replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return null;
  return Math.round(amount * 100) / 100;
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

  @Get('stop/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async stopPage(@Param('token') token: string): Promise<string> {
    const contact = await this.outreach.findByToken(token);
    if (!contact) return this.gone('en');
    const lang = contact.language ?? contact.poi.language;
    const words = outreachText(lang);
    if (contact.unsubscribedAt) return this.stopped(words, lang, contact.poi);
    return publicPage({
      lang,
      title: fill(words.stopTitle, { community: contact.poi.name }),
      community: contact.poi.name,
      logoUrl: contact.poi.logoUrl,
      body: `<p>${escapeHtml(fill(words.stopText, { community: contact.poi.name }))}</p>
<form method="post"><button type="submit">${escapeHtml(words.stopButton)}</button></form>`,
    });
  }

  // The page's button, and mail apps' one-click "Unsubscribe" (RFC 8058).
  @Post('stop/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async stop(@Param('token') token: string): Promise<string> {
    const contact = await this.outreach.stop(token);
    if (!contact) return this.gone('en');
    const lang = contact.language ?? contact.poi.language;
    return this.stopped(outreachText(lang), lang, contact.poi);
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
   * A community's own pay link, the one behind its printed or shared QR
   * code (Seb, 10 Nov 2026): anyone can open it, no sign-in, and pay by
   * card, Apple Pay or Google Pay on Stripe's page. Optional ?campaign=
   * names a project, ?amount= suggests an amount the payer can change.
   */
  @Get('pay/:poiId')
  @Header('Cache-Control', 'no-store')
  async payPage(
    @Param('poiId') poiId: string,
    @Query('campaign') campaignId: string | undefined,
    @Query('amount') amount: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const poi = await this.payablePoi(poiId);
    if (!poi) {
      res.type('html').send(this.gone('en'));
      return;
    }
    const campaign = await this.outreach.findCampaign(poi.id, campaignId);
    const action = `/m/pay/${poi.id}${campaign ? `?campaign=${campaign.id}` : ''}`;
    res.type('html').send(this.givePage(poi, poi.language, campaign, null, action, presetAmount(amount)));
  }

  @Post('pay/:poiId')
  async pay(
    @Param('poiId') poiId: string,
    @Query('campaign') campaignId: string | undefined,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const poi = await this.payablePoi(poiId);
    if (!poi) {
      res.type('html').send(this.gone('en'));
      return;
    }
    const campaign = await this.outreach.findCampaign(poi.id, campaignId);
    await this.checkout(poi, poi.language, campaign, null, body, req, res);
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
    return payoutsReady(poi, this.stripe.isConfigured) ? poi : null;
  }

  private async checkout(
    poi: Poi,
    lang: string,
    campaign: DonationCampaign | null,
    contactId: string | null,
    body: Record<string, unknown>,
    req: Request,
    res: Response,
  ): Promise<void> {
    const amount = amountOf(body);
    const back = req.originalUrl;
    if (!amount) {
      res.redirect(303, back);
      return;
    }
    const donorName = String(body.name ?? '').trim().slice(0, 80) || undefined;
    const result = await this.donations.startCheckout(
      poi.id,
      {
        amount,
        donorName,
        purpose: campaign ? DonationPurpose.CAMPAIGN : DonationPurpose.GENERAL,
        ...(campaign ? { campaignId: campaign.id } : {}),
      },
      returnUrlBase(this.config, req),
      { ...(contactId ? { contactId } : {}), returnPath: `/m/done/${encodeURIComponent(lang)}` },
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
  ): string {
    const words = outreachText(lang);
    const paymentsLive = this.stripe.isConfigured;
    const presetIsChip = preset !== null && AMOUNTS.includes(preset);
    const checkedChip = preset === null ? 10 : presetIsChip ? preset : null;
    const otherValue = preset !== null && !presetIsChip ? String(preset) : '';
    const chips = AMOUNTS.map(
      (a) => `<label><input type="radio" name="amount" value="${a}"${a === checkedChip ? ' checked' : ''}>${a} €</label>`,
    ).join('');
    return publicPage({
      lang,
      title: fill(words.giveTitle, { community: poi.name }),
      community: poi.name,
      logoUrl: poi.logoUrl,
      body: `<p>${escapeHtml(campaign ? fill(words.giveProject, { project: campaign.title }) : words.giveIntro)}</p>
<form method="post" action="${escapeHtml(action)}">
<label style="margin-top:8px">${escapeHtml(words.giveAmount)}</label>
<div class="amounts">${chips}<label><input type="radio" name="amount" value="other"${otherValue ? ' checked' : ''}>${escapeHtml(words.giveOther)}</label></div>
<label for="other">${escapeHtml(words.giveOther)} (€)</label>
<input id="other" name="other" inputmode="decimal" placeholder="25" value="${escapeHtml(otherValue)}" oninput="if(this.value)document.querySelector('input[value=other]').checked=true">
<label for="name">${escapeHtml(words.giveName)}</label>
<input id="name" name="name" maxlength="80" value="${escapeHtml(name ?? '')}" autocomplete="name">
<button type="submit">${escapeHtml(words.giveButton)}</button>
<p class="small">${escapeHtml(paymentsLive ? words.giveSecure : words.giveDemo)}</p>
</form>`,
    });
  }

  private stopped(words: OutreachText, lang: string, poi: Poi): string {
    return publicPage({
      lang,
      title: words.stoppedTitle,
      community: poi.name,
      logoUrl: poi.logoUrl,
      body: `<p>${escapeHtml(fill(words.stoppedText, { community: poi.name }))}</p>`,
    });
  }

  private gone(lang: string): string {
    const words = outreachText(lang);
    return publicPage({ lang, title: words.goneTitle, body: `<p>${escapeHtml(words.goneText)}</p>` });
  }
}
