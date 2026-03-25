const MAX_HTML_SIZE = 50 * 1024;
const MAX_TEXT_SIZE = 10 * 1024;
const MAX_QUERY_RESULTS = 20;
const MAX_ELEMENT_TEXT = 200;

const NOISE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "SVG",
  "TEMPLATE",
  "IFRAME",
]);

function isElementVisible(el) {
  if (!(el instanceof HTMLElement)) return true;
  if (el.offsetParent === null) {
    const pos = getComputedStyle(el).position;
    if (pos !== "fixed" && pos !== "sticky") return false;
  }
  const style = getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    parseFloat(style.opacity) !== 0
  );
}

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+data-[\w-]+="[^"]*"/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function extractCleanText(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (NOISE_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
          if (!isElementVisible(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const chunks = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    if (text) chunks.push(text);
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function findMainContent() {
  return (
    document.querySelector("main, article, [role='main']") || document.body
  );
}

const api =
  typeof browser !== "undefined" && browser.runtime?.id ? browser : chrome;

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ __error: err.message }));
  return true;
});

async function handleMessage(message) {
  const { action, params } = message;

  switch (action) {
    case "dom.getHtml": {
      const selector = params.selector || "body";
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      const outer = params.outer !== false;
      let html = outer ? el.outerHTML : el.innerHTML;
      if (params.clean !== false) {
        html = cleanHtml(html);
      }
      if (html.length > MAX_HTML_SIZE) {
        html = html.slice(0, MAX_HTML_SIZE) + "\n<!-- truncated -->";
      }
      return html;
    }

    case "dom.getText": {
      const root = params.selector
        ? document.querySelector(params.selector)
        : params.mainContent !== false
          ? findMainContent()
          : document.body;
      if (!root) throw new Error(`Element not found: ${params.selector}`);
      let text;
      if (params.raw === true) {
        text = root.textContent || "";
      } else {
        text = extractCleanText(root);
      }
      if (text.length > MAX_TEXT_SIZE) {
        text = text.slice(0, MAX_TEXT_SIZE) + "\n... (truncated)";
      }
      return text;
    }

    case "dom.querySelector": {
      const limit = params.limit || MAX_QUERY_RESULTS;
      const elements = document.querySelectorAll(params.selector);
      const results = [];
      for (let i = 0; i < elements.length && results.length < limit; i++) {
        const el = elements[i];
        if (params.visibleOnly && !isElementVisible(el)) continue;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
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
      el.scrollIntoView({ behavior: "instant", block: "center" });
      el.click();
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return null;
    }

    case "interaction.type": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      el.focus();
      if (params.clear !== false) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const nativeInputValueSetter =
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set ||
        Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(
          el,
          (params.clear !== false ? "" : el.value) + params.text,
        );
      } else {
        el.value = (params.clear !== false ? "" : el.value) + params.text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return null;
    }

    case "interaction.scroll": {
      if (params.selector) {
        const el = document.querySelector(params.selector);
        if (!el) throw new Error(`Element not found: ${params.selector}`);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollBy({
          left: params.x || 0,
          top: params.y || 0,
          behavior: "smooth",
        });
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
      const opts = { key: params.key, bubbles: true, cancelable: true };
      target.dispatchEvent(new KeyboardEvent("keydown", opts));
      target.dispatchEvent(new KeyboardEvent("keypress", opts));
      target.dispatchEvent(new KeyboardEvent("keyup", opts));
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
