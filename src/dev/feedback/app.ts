import { defineToolbarApp } from 'astro/toolbar';
import { toCanvas } from 'html-to-image';

const SEND_EVENT = 'aesymnetes-feedback:send';
const SAVED_EVENT = 'aesymnetes-feedback:saved';
const MIN_SHOT_SIZE = 48;
const MAX_TEXT = 120;

// The toolbar's own elements must never be picked.
const isToolbar = (el: Element) => el.closest('astro-dev-toolbar') !== null;

const CONTROL = 'button, a, input, select, textarea, label, [role="button"], [role="radio"], [role="slider"], [role="switch"]';

/** The element the user means: a click on a button's label means the button. */
function meaningful(el: Element): Element {
  return el.closest(CONTROL) ?? el;
}

// Mantine's generated class names (m_1a2b3c4d) say nothing about the element.
const usefulClass = (c: string) => !/^m_[0-9a-f]+$/.test(c);

function cssSelector(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.body && parts.length < 5) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const classes = [...node.classList].filter(usefulClass).slice(0, 2);
    if (classes.length) part += classes.map((c) => `.${CSS.escape(c)}`).join('');
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === node!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

function describe(el: Element) {
  const rect = el.getBoundingClientRect();
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const sourceEl = el.closest('[data-astro-source-file]');
  const source = sourceEl
    ? `${sourceEl.getAttribute('data-astro-source-file')}:${sourceEl.getAttribute('data-astro-source-loc') ?? ''}`
    : null;
  return {
    tag: el.tagName.toLowerCase(),
    selector: cssSelector(el),
    text: text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + '…' : text,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    source,
  };
}

async function screenshot(el: Element): Promise<string | null> {
  // Tiny targets say little on their own; show them in their surroundings.
  let target: Element = el;
  while (
    target.parentElement &&
    target.parentElement !== document.body &&
    (target.getBoundingClientRect().width < MIN_SHOT_SIZE || target.getBoundingClientRect().height < MIN_SHOT_SIZE)
  ) {
    target = target.parentElement;
  }
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    const canvas = await toCanvas(target as HTMLElement, { backgroundColor: bg, pixelRatio: 1, cacheBust: true });
    if (target !== el) {
      // Mark the picked element inside its wider surroundings.
      const outer = target.getBoundingClientRect();
      const inner = el.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#e5398f';
        ctx.lineWidth = 3;
        ctx.strokeRect(inner.left - outer.left - 3, inner.top - outer.top - 3, inner.width + 6, inner.height + 6);
      }
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

const STYLES = `
  :host { all: initial; }
  .outline {
    position: fixed; pointer-events: none; z-index: 2147483646;
    border: 2px solid #3d7cf0; background: rgba(61, 124, 240, 0.12); border-radius: 2px;
    display: none;
  }
  .hint, .box, .toast {
    position: fixed; z-index: 2147483647;
    font: 14px/1.4 system-ui, sans-serif; color: #f2f4f7;
    background: #181c24; border: 1px solid #343b48; border-radius: 6px;
    box-shadow: 0 6px 24px rgba(0,0,0,.35);
  }
  .hint { left: 50%; top: 12px; transform: translateX(-50%); padding: 6px 12px; }
  .box { width: 300px; padding: 10px; display: none; }
  .box p { margin: 0 0 6px; color: #a8b1bf; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  textarea {
    width: 100%; box-sizing: border-box; min-height: 72px; resize: vertical;
    font: inherit; color: inherit; background: #0f1218; border: 1px solid #343b48; border-radius: 4px; padding: 6px;
  }
  textarea:focus { outline: 2px solid #3d7cf0; outline-offset: 0; }
  .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  button {
    font: inherit; padding: 4px 12px; border-radius: 4px; cursor: pointer;
    border: 1px solid #343b48; background: transparent; color: inherit;
  }
  button.primary { background: #3d7cf0; border-color: #3d7cf0; color: #fff; }
  button:disabled { opacity: .5; cursor: default; }
  .toast { right: 16px; bottom: 72px; padding: 8px 12px; display: none; }
`;

export default defineToolbarApp({
  init(canvas, app, server) {
    const clientId = Math.random().toString(36).slice(2);
    canvas.innerHTML = `
      <style>${STYLES}</style>
      <div class="outline"></div>
      <div class="hint" hidden>Click the element you want to comment on. Esc to stop.</div>
      <div class="box" role="dialog" aria-label="Note for Claude">
        <p class="target"></p>
        <textarea placeholder="What should change here?"></textarea>
        <div class="row">
          <button type="button" class="cancel">Cancel</button>
          <button type="button" class="primary send">Send</button>
        </div>
      </div>
      <div class="toast" role="status"></div>
    `;
    const $ = <T extends Element>(s: string) => canvas.querySelector(s) as T;
    const outline = $<HTMLDivElement>('.outline');
    const hint = $<HTMLDivElement>('.hint');
    const box = $<HTMLDivElement>('.box');
    const targetLabel = $<HTMLParagraphElement>('.target');
    const textarea = $<HTMLTextAreaElement>('textarea');
    const sendButton = $<HTMLButtonElement>('.send');
    const toast = $<HTMLDivElement>('.toast');

    let picking = false;
    let selected: Element | null = null;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    const showToast = (text: string) => {
      toast.textContent = text;
      toast.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast.style.display = 'none'), 2500);
    };

    const place = (el: Element) => {
      const r = el.getBoundingClientRect();
      Object.assign(outline.style, {
        display: 'block',
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    };

    const openBox = (el: Element) => {
      selected = el;
      place(el);
      const d = describe(el);
      targetLabel.textContent = `<${d.tag}> ${d.text || d.selector}`;
      const r = el.getBoundingClientRect();
      const left = Math.min(Math.max(8, r.left), window.innerWidth - 308);
      const below = r.bottom + 8;
      const top = below + 160 < window.innerHeight ? below : Math.max(8, r.top - 168);
      Object.assign(box.style, { display: 'block', left: `${left}px`, top: `${top}px` });
      textarea.value = '';
      textarea.focus();
    };

    const closeBox = () => {
      selected = null;
      box.style.display = 'none';
      outline.style.display = 'none';
    };

    const onMove = (e: MouseEvent) => {
      if (!picking || selected) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && !isToolbar(el)) place(meaningful(el));
    };

    // Capture phase, so the page never sees the click that picks an element.
    const onClick = (e: MouseEvent) => {
      if (!picking || selected) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || isToolbar(el)) return;
      e.preventDefault();
      e.stopPropagation();
      openBox(meaningful(el));
    };
    const swallow = (e: Event) => {
      if (picking && !selected && e.target instanceof Element && !isToolbar(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !picking) return;
      if (selected) closeBox();
      else app.toggleState({ state: false });
    };

    const setPicking = (on: boolean) => {
      picking = on;
      hint.hidden = !on;
      if (!on) closeBox();
      const method = on ? 'addEventListener' : 'removeEventListener';
      document[method]('mousemove', onMove, true);
      document[method]('click', onClick, true);
      document[method]('mousedown', swallow, true);
      document[method]('pointerdown', swallow, true);
      document[method]('keydown', onKey, true);
    };

    const send = async () => {
      if (!selected || !textarea.value.trim()) {
        textarea.focus();
        return;
      }
      sendButton.disabled = true;
      const el = selected;
      // Hide our own overlay so it is not in the screenshot.
      outline.style.display = 'none';
      box.style.visibility = 'hidden';
      const png = await screenshot(el);
      box.style.visibility = '';
      server.send(SEND_EVENT, {
        clientId,
        png,
        note: {
          url: location.href,
          title: document.title,
          note: textarea.value.trim(),
          viewport: { width: window.innerWidth, height: window.innerHeight },
          colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          element: describe(el),
        },
      });
    };

    server.on(SAVED_EVENT, (data: { clientId: string; ok: boolean }) => {
      if (data.clientId !== clientId) return;
      sendButton.disabled = false;
      if (data.ok) {
        closeBox();
        showToast('Sent to Claude. Pick another element or press Esc.');
      } else {
        showToast('The note was not saved. See the dev server log.');
      }
    });

    sendButton.addEventListener('click', send);
    $<HTMLButtonElement>('.cancel').addEventListener('click', closeBox);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
    });

    app.onToggled(({ state }) => setPicking(state));
  },
});
