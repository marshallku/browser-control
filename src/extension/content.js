const MAX_HTML_SIZE = 50 * 1024;
const MAX_TEXT_SIZE = 10 * 1024;
const MAX_QUERY_RESULTS = 20;
const MAX_ELEMENT_TEXT = 200;

const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ __error: err.message }));
  return true;
});

// ── Human-like simulation helpers ──────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

/** Get the center point of an element in viewport coordinates */
function getElementCenter(el) {
  const rect = el.getBoundingClientRect();
  // Add slight randomness so we don't always hit dead center
  const offsetX = rand(-rect.width * 0.15, rect.width * 0.15);
  const offsetY = rand(-rect.height * 0.15, rect.height * 0.15);
  return {
    x: rect.left + rect.width / 2 + offsetX,
    y: rect.top + rect.height / 2 + offsetY,
  };
}

/** Cubic Bézier interpolation */
function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  );
}

/**
 * Generate a human-like mouse path from (sx,sy) to (ex,ey)
 * using a cubic Bézier with randomized control points.
 */
function generateMousePath(sx, sy, ex, ey, steps) {
  // Control points with randomness to create natural curve
  const cp1x = sx + (ex - sx) * rand(0.1, 0.4) + rand(-50, 50);
  const cp1y = sy + (ey - sy) * rand(0.0, 0.3) + rand(-50, 50);
  const cp2x = sx + (ex - sx) * rand(0.6, 0.9) + rand(-30, 30);
  const cp2y = sy + (ey - sy) * rand(0.7, 1.0) + rand(-30, 30);

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Apply ease-in-out for more natural acceleration
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    points.push({
      x: bezierPoint(eased, sx, cp1x, cp2x, ex),
      y: bezierPoint(eased, sy, cp1y, cp2y, ey),
    });
  }
  return points;
}

/** Dispatch a MouseEvent on the element at (x, y) */
function fireMouseEvent(type, x, y, el, extra = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x + window.screenX,
    screenY: y + window.screenY,
    button: extra.button ?? 0,
    buttons: extra.buttons ?? (type === "mousedown" ? 1 : 0),
    ...extra,
  });
  el.dispatchEvent(event);
}

/** Dispatch a PointerEvent on the element at (x, y) */
function firePointerEvent(type, x, y, el, extra = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x + window.screenX,
    screenY: y + window.screenY,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: extra.button ?? 0,
    buttons: extra.buttons ?? 0,
    ...extra,
  });
  el.dispatchEvent(event);
}

/**
 * Simulate mouse movement along a path, firing mousemove events
 * with small random delays between steps.
 */
async function simulateMouseMove(path, targetEl) {
  let entered = false;
  for (let i = 0; i < path.length; i++) {
    const { x, y } = path[i];
    const elAtPoint = document.elementFromPoint(x, y) || targetEl;
    const isOverTarget = targetEl.contains(elAtPoint) || elAtPoint === targetEl;

    if (isOverTarget && !entered) {
      entered = true;
      firePointerEvent("pointerenter", x, y, targetEl);
      fireMouseEvent("mouseenter", x, y, targetEl);
      firePointerEvent("pointerover", x, y, targetEl);
      fireMouseEvent("mouseover", x, y, targetEl);
    }

    firePointerEvent("pointermove", x, y, elAtPoint);
    fireMouseEvent("mousemove", x, y, elAtPoint);

    // Random micro-delay between moves (1-4ms for ~60fps feel)
    if (i < path.length - 1) {
      await sleep(rand(1, 4));
    }
  }
  return entered;
}

/**
 * Human-like click: scroll into view, move mouse along Bézier curve,
 * fire full event sequence.
 */
async function humanClick(el) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(rand(80, 200));

  const { x, y } = getElementCenter(el);

  // Start from a random point on screen
  const startX = rand(0, window.innerWidth);
  const startY = rand(0, window.innerHeight);
  const steps = randInt(15, 35);
  const path = generateMousePath(startX, startY, x, y, steps);

  // Move mouse along path
  await simulateMouseMove(path, el);

  // Small pause before clicking (human reaction)
  await sleep(rand(30, 80));

  // Full click event sequence
  firePointerEvent("pointerdown", x, y, el, { button: 0, buttons: 1 });
  fireMouseEvent("mousedown", x, y, el, { button: 0, buttons: 1 });

  await sleep(rand(50, 120)); // Hold duration

  firePointerEvent("pointerup", x, y, el, { button: 0, buttons: 0 });
  fireMouseEvent("mouseup", x, y, el, { button: 0, buttons: 0 });
  fireMouseEvent("click", x, y, el, { button: 0 });

  // Also fire the native click for elements that rely on it
  el.click();
}

/**
 * Human-like hover: move mouse to element and stay.
 */
async function humanHover(el, durationMs) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(rand(80, 180));

  const { x, y } = getElementCenter(el);
  const startX = rand(0, window.innerWidth);
  const startY = rand(0, window.innerHeight);
  const steps = randInt(15, 30);
  const path = generateMousePath(startX, startY, x, y, steps);

  await simulateMouseMove(path, el);

  // Hover duration with small idle movements
  const hoverTime = durationMs || rand(300, 800);
  const idleMoves = randInt(2, 5);
  const interval = hoverTime / idleMoves;
  for (let i = 0; i < idleMoves; i++) {
    await sleep(interval);
    const jitterX = x + rand(-3, 3);
    const jitterY = y + rand(-3, 3);
    firePointerEvent("pointermove", jitterX, jitterY, el);
    fireMouseEvent("mousemove", jitterX, jitterY, el);
  }
}

/**
 * Human-like typing: character by character with keydown/keypress/input/keyup
 * and random inter-key delays.
 */
async function humanType(el, text, clear) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(rand(50, 150));

  // Focus with mouse click on the element first
  const { x, y } = getElementCenter(el);
  fireMouseEvent("mousedown", x, y, el, { button: 0, buttons: 1 });
  fireMouseEvent("mouseup", x, y, el, { button: 0 });
  fireMouseEvent("click", x, y, el, { button: 0 });
  el.focus();
  el.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

  await sleep(rand(50, 150));

  // Get native setter for React-compatible value setting
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
      ?.set ||
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;

  if (clear !== false) {
    // Select all and delete like a human would
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "a",
        code: "KeyA",
        ctrlKey: true,
        bubbles: true,
      }),
    );
    el.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "a",
        code: "KeyA",
        ctrlKey: true,
        bubbles: true,
      }),
    );
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, "");
    } else {
      el.value = "";
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(rand(30, 80));
  }

  // Type each character
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = `Key${char.toUpperCase()}`;
    const keyOpts = { key: char, code, bubbles: true, cancelable: true };

    el.dispatchEvent(new KeyboardEvent("keydown", keyOpts));
    el.dispatchEvent(new KeyboardEvent("keypress", keyOpts));

    // Update value
    const currentVal = el.value || "";
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, currentVal + char);
    } else {
      el.value = currentVal + char;
    }

    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: char,
      }),
    );
    el.dispatchEvent(new KeyboardEvent("keyup", keyOpts));

    // Random delay between keystrokes (30-120ms, occasional longer pause)
    const delay = Math.random() < 0.1 ? rand(150, 300) : rand(30, 120);
    await sleep(delay);
  }

  // Dispatch change at the end
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Human-like scroll with easing and multiple small steps.
 */
async function humanScroll(target, deltaX, deltaY) {
  const totalSteps = randInt(8, 20);
  let scrolled = 0;

  for (let i = 0; i <= totalSteps; i++) {
    const t = i / totalSteps;
    // Ease-out cubic for natural deceleration
    const eased = 1 - Math.pow(1 - t, 3);
    const newScrolled = eased;
    const stepFraction = newScrolled - scrolled;
    scrolled = newScrolled;

    const stepX = deltaX * stepFraction;
    const stepY = deltaY * stepFraction;

    // Fire wheel event
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaX: stepX,
      deltaY: stepY,
      deltaMode: 0, // pixels
    });
    target.dispatchEvent(wheelEvent);

    if (
      target === document.documentElement ||
      target === document.body ||
      target === window
    ) {
      window.scrollBy({ left: stepX, top: stepY });
    } else {
      target.scrollLeft += stepX;
      target.scrollTop += stepY;
    }

    await sleep(rand(10, 30));
  }
}

/**
 * Human-like key press with proper event sequence and timing.
 */
async function humanPressKey(target, key) {
  target.focus();
  await sleep(rand(30, 80));

  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  const opts = { key, code, bubbles: true, cancelable: true };

  target.dispatchEvent(new KeyboardEvent("keydown", opts));
  await sleep(rand(5, 20));
  target.dispatchEvent(new KeyboardEvent("keypress", opts));

  // For single characters, also fire input event
  if (key.length === 1) {
    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: key,
      }),
    );
  }

  await sleep(rand(50, 130)); // Hold time
  target.dispatchEvent(new KeyboardEvent("keyup", opts));
}

// ── Message handler ────────────────────────────────────────────────────

async function handleMessage(message) {
  const { action, params } = message;

  switch (action) {
    case "dom.getHtml": {
      const selector = params.selector || "body";
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      const outer = params.outer !== false;
      let html = outer ? el.outerHTML : el.innerHTML;
      if (html.length > MAX_HTML_SIZE) {
        html = html.slice(0, MAX_HTML_SIZE) + "\n<!-- truncated -->";
      }
      return html;
    }

    case "dom.getText": {
      const selector = params.selector || "body";
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      let text = el.textContent || "";
      if (text.length > MAX_TEXT_SIZE) {
        text = text.slice(0, MAX_TEXT_SIZE) + "\n... (truncated)";
      }
      return text;
    }

    case "dom.querySelector": {
      const limit = params.limit || MAX_QUERY_RESULTS;
      const elements = document.querySelectorAll(params.selector);
      const results = [];
      for (let i = 0; i < Math.min(elements.length, limit); i++) {
        const el = elements[i];
        const text = (el.textContent || "").trim();
        results.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className || undefined,
          text:
            text.length > MAX_ELEMENT_TEXT
              ? text.slice(0, MAX_ELEMENT_TEXT) + "..."
              : text,
          attributes: getAttributes(el),
        });
      }
      return { count: elements.length, results };
    }

    case "interaction.click": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      await humanClick(el);
      return null;
    }

    case "interaction.hover": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      await humanHover(el, params.duration);
      return null;
    }

    case "interaction.type": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      await humanType(el, params.text, params.clear);
      return null;
    }

    case "interaction.scroll": {
      if (params.selector) {
        const el = document.querySelector(params.selector);
        if (!el) throw new Error(`Element not found: ${params.selector}`);
        // Scroll the element into view with human-like scroll
        const rect = el.getBoundingClientRect();
        const targetY = rect.top - window.innerHeight / 2 + rect.height / 2;
        const targetX = rect.left - window.innerWidth / 2 + rect.width / 2;
        await humanScroll(document.documentElement, targetX, targetY);
      } else {
        await humanScroll(
          document.documentElement,
          params.x || 0,
          params.y || 0,
        );
      }
      return null;
    }

    case "interaction.pressKey": {
      const target = params.selector
        ? document.querySelector(params.selector)
        : document.activeElement;
      if (!target)
        throw new Error(
          params.selector
            ? `Element not found: ${params.selector}`
            : "No active element",
        );
      await humanPressKey(target, params.key);
      return null;
    }

    case "capture.computedStyles": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      const computed = window.getComputedStyle(el);
      if (params.properties && params.properties.length > 0) {
        const result = {};
        for (const prop of params.properties) {
          result[prop] = computed.getPropertyValue(prop);
        }
        return result;
      }
      const result = {};
      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        result[prop] = computed.getPropertyValue(prop);
      }
      return result;
    }

    default:
      throw new Error(`Unknown content action: ${action}`);
  }
}

function getAttributes(el) {
  const attrs = {};
  for (const attr of el.attributes) {
    if (["id", "class"].includes(attr.name)) continue;
    attrs[attr.name] = attr.value;
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}
