// A small frame-by-frame recorder: it drives the real admin with
// Playwright, draws a cursor, click ripples and captions on top, takes
// one screenshot per frame and pipes them to ffmpeg. Time is virtual, so
// a slow page never makes the clip stutter, and nothing here is paid for.
import { spawn } from 'node:child_process';

export const FPS = 30;
export const VIEWPORT = { width: 1280, height: 800 };
export const SCALE = 1.5; // 1920 × 1200 video

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const OVERLAY_CSS = `
#wt-overlay{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
#wt-cursor{position:absolute;left:0;top:0;width:30px;height:30px;transform-origin:3px 2px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
#wt-ripple{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid #6a4ee0;background:rgba(106,78,224,.2);opacity:0}
#wt-caption{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);max-width:82%;background:rgba(20,16,40,.9);color:#fff;
  font:600 22px/1.35 system-ui,-apple-system,'Segoe UI',sans-serif;padding:12px 24px;border-radius:999px;text-align:center;opacity:0;white-space:nowrap}
#wt-veil{position:absolute;inset:0;background:#fff;opacity:0}
.page-tip{display:none!important}
*{scroll-behavior:auto!important;caret-color:transparent}
`;
const CURSOR_SVG = `<svg id="wt-cursor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 2l15 11-6.5 1.2L15 21l-3 1.4-3.4-6.8L3 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export class Recorder {
  constructor(page, outFile) {
    this.page = page;
    this.cursor = { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.55 };
    this.caption = { text: '', opacity: 0 };
    this.ripple = { x: 0, y: 0, t: -1 };
    this.press = 1;
    this.veil = 1;
    this.live = 0; // frames that must be shot fresh (the page is changing)
    this.dirty = true;
    this.last = null;
    this.frames = 0;
    this.ff = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    this.done = new Promise((resolve, reject) =>
      this.ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))),
    );
  }

  async install() {
    await this.page.evaluate(
      ({ css, svg }) => {
        if (document.getElementById('wt-overlay')) return;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        const o = document.createElement('div');
        o.id = 'wt-overlay';
        o.innerHTML = `<div id="wt-ripple"></div>${svg}<div id="wt-caption"></div><div id="wt-veil"></div>`;
        document.body.appendChild(o);
      },
      { css: OVERLAY_CSS, svg: CURSOR_SVG },
    );
  }

  async frame() {
    if (this.dirty || this.live > 0) {
      await this.page.evaluate((s) => {
        const c = document.getElementById('wt-cursor');
        c.style.transform = `translate(${s.x - 3}px, ${s.y - 2}px) scale(${s.press})`;
        const cap = document.getElementById('wt-caption');
        if (cap.textContent !== s.text) cap.textContent = s.text;
        cap.style.opacity = String(s.opacity);
        const r = document.getElementById('wt-ripple');
        if (s.rt < 0) r.style.opacity = '0';
        else {
          r.style.left = `${s.rx}px`;
          r.style.top = `${s.ry}px`;
          r.style.opacity = String(1 - s.rt);
          r.style.transform = `scale(${0.4 + s.rt * 1.1})`;
        }
        document.getElementById('wt-veil').style.opacity = String(s.veil);
      }, {
        x: this.cursor.x, y: this.cursor.y, press: this.press, text: this.caption.text, opacity: this.caption.opacity,
        rx: this.ripple.x, ry: this.ripple.y, rt: this.ripple.t, veil: this.veil,
      });
      this.last = await this.page.screenshot({ type: 'jpeg', quality: 92 });
      this.dirty = false;
      if (this.live > 0) this.live--;
    }
    if (!this.ff.stdin.write(this.last)) await new Promise((r) => this.ff.stdin.once('drain', r));
    this.frames++;
  }

  async hold(seconds) {
    for (let i = 0; i < Math.round(seconds * FPS); i++) await this.frame();
  }

  async fadeIn() {
    await this.page.waitForTimeout(400);
    for (let i = 0; i <= 12; i++) {
      this.veil = 1 - ease(i / 12);
      this.dirty = true;
      await this.frame();
    }
  }

  async fadeOut() {
    await this.say('');
    for (let i = 0; i <= 15; i++) {
      this.veil = ease(i / 15);
      this.dirty = true;
      await this.frame();
    }
  }

  /** Caption: fades the old one out and the new one in. */
  async say(text) {
    if (this.caption.text) {
      for (let i = 1; i <= 6; i++) {
        this.caption.opacity = 1 - i / 6;
        this.dirty = true;
        await this.frame();
      }
    }
    this.caption.text = text;
    if (!text) return;
    for (let i = 1; i <= 8; i++) {
      this.caption.opacity = ease(i / 8);
      this.dirty = true;
      await this.frame();
    }
  }

  async locate(target) {
    if (typeof target === 'object' && 'x' in target) return target;
    const loc = (typeof target === 'string' ? this.page.locator(target) : target).filter({ visible: true }).first();
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    const box = await loc.boundingBox();
    if (!box) throw new Error(`Not on screen: ${target}`);
    return { x: box.x + Math.min(box.width / 2, 60), y: box.y + box.height / 2 };
  }

  /** Glides the cursor to a target, in a slight arc. */
  async move(target, seconds = 0.9) {
    const to = await this.locate(target);
    const from = { ...this.cursor };
    const n = Math.max(1, Math.round(seconds * FPS));
    const lift = Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) * 0.12);
    for (let i = 1; i <= n; i++) {
      const t = ease(i / n);
      this.cursor = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * lift };
      this.dirty = true;
      await this.frame();
    }
    await this.page.mouse.move(to.x, to.y);
  }

  /** Moves, presses with a ripple, and really clicks. */
  async click(target, { settle = 900, seconds = 0.9 } = {}) {
    await this.move(target, seconds);
    this.ripple = { x: this.cursor.x, y: this.cursor.y, t: 0 };
    for (let i = 0; i < 4; i++) {
      this.press = 1 - 0.15 * Math.sin((Math.PI * (i + 1)) / 4);
      this.ripple.t = i / 14;
      this.dirty = true;
      await this.frame();
    }
    await this.page.mouse.click(this.cursor.x, this.cursor.y);
    await this.page.waitForTimeout(settle);
    await this.install();
    this.live = 12;
    for (let i = 4; i <= 14; i++) {
      this.press = 1;
      this.ripple.t = i / 14;
      this.dirty = true;
      await this.frame();
    }
    this.ripple.t = -1;
    this.dirty = true;
  }

  async type(text) {
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      this.dirty = true;
      await this.frame();
      await this.frame();
    }
  }

  /** Clicks a <select> and picks a value (the native list is not drawn). */
  async select(selector, value) {
    await this.move(selector, 0.9);
    this.ripple = { x: this.cursor.x, y: this.cursor.y, t: 0 };
    await this.page.locator(selector).filter({ visible: true }).first().selectOption(value);
    await this.page.waitForTimeout(500);
    this.live = 10;
    for (let i = 0; i <= 14; i++) {
      this.ripple.t = i / 14;
      this.dirty = true;
      await this.frame();
    }
    this.ripple.t = -1;
    this.dirty = true;
  }

  /** Scrolls the page's content smoothly by dy pixels, or to an element. */
  async scroll(by, seconds = 1.2) {
    const start = await this.page.evaluate(() => {
      const el = document.scrollingElement;
      return el.scrollTop;
    });
    let dy = by;
    if (typeof by === 'string') {
      const box = await this.page.locator(by).first().boundingBox();
      dy = box.y - 90;
    }
    const n = Math.round(seconds * FPS);
    for (let i = 1; i <= n; i++) {
      await this.page.evaluate((y) => window.scrollTo(0, y), start + dy * ease(i / n));
      this.dirty = true;
      await this.frame();
    }
  }

  poster() {
    return this.last;
  }

  async finish() {
    this.ff.stdin.end();
    await this.done;
    return this.frames / FPS;
  }
}
