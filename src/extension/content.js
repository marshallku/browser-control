const MAX_HTML_SIZE = 50 * 1024;
const MAX_TEXT_SIZE = 10 * 1024;
const MAX_QUERY_RESULTS = 20;
const MAX_ELEMENT_TEXT = 200;

const MAX_CONSOLE_BUFFER = 100;
const MAX_ERROR_BUFFER = 50;

const consoleBuffer = [];
const errorBuffer = [];

(function setupMonitoring() {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  function capture(level, args) {
    const entry = {
      level,
      message: Array.from(args)
        .map((a) => {
          try {
            return typeof a === "string" ? a : JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" "),
      timestamp: Date.now(),
    };
    consoleBuffer.push(entry);
    if (consoleBuffer.length > MAX_CONSOLE_BUFFER) consoleBuffer.shift();
  }

  console.log = function (...args) {
    capture("log", args);
    return origLog.apply(console, args);
  };
  console.warn = function (...args) {
    capture("warn", args);
    return origWarn.apply(console, args);
  };
  console.error = function (...args) {
    capture("error", args);
    return origError.apply(console, args);
  };

  window.addEventListener("error", (event) => {
    errorBuffer.push({
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      timestamp: Date.now(),
    });
    if (errorBuffer.length > MAX_ERROR_BUFFER) errorBuffer.shift();
  });

  window.addEventListener("unhandledrejection", (event) => {
    errorBuffer.push({
      message: `Unhandled Promise Rejection: ${event.reason}`,
      timestamp: Date.now(),
    });
    if (errorBuffer.length > MAX_ERROR_BUFFER) errorBuffer.shift();
  });
})();

const MAX_A11Y_ELEMENTS = 500;
const MAX_A11Y_OUTPUT = 30 * 1024;

const annotationMap = new Map();
let annotationContainer = null;

const TAG_ROLE_MAP = {
  A: "link",
  BUTTON: "button",
  INPUT: "textbox",
  TEXTAREA: "textbox",
  SELECT: "combobox",
  IMG: "image",
  NAV: "navigation",
  MAIN: "main",
  HEADER: "banner",
  FOOTER: "contentinfo",
  ASIDE: "complementary",
  FORM: "form",
  TABLE: "table",
  H1: "heading",
  H2: "heading",
  H3: "heading",
  H4: "heading",
  H5: "heading",
  H6: "heading",
};

const INPUT_TYPE_ROLE = {
  checkbox: "checkbox",
  radio: "radio",
  submit: "button",
  reset: "button",
  button: "button",
  range: "slider",
  number: "spinbutton",
  search: "searchbox",
};

const INTERACTIVE_TAGS = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "DETAILS",
  "SUMMARY",
]);

function inferRole(el) {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  if (el.tagName === "INPUT") {
    return INPUT_TYPE_ROLE[el.type?.toLowerCase()] || "textbox";
  }
  return TAG_ROLE_MAP[el.tagName] || null;
}

function getAccessibleName(el) {
  const label = el.getAttribute("aria-label");
  if (label) return label;

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  if (el.tagName === "IMG") return el.alt || "";
  if (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  ) {
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl) return labelEl.textContent.trim();
    }
    if (el.placeholder) return el.placeholder;
  }

  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  return text.length > MAX_ELEMENT_TEXT
    ? text.slice(0, MAX_ELEMENT_TEXT) + "..."
    : text;
}

function isInteractive(el) {
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.getAttribute("role")) return true;
  if (el.getAttribute("tabindex") !== null) return true;
  if (el.getAttribute("onclick")) return true;
  try {
    const cursor = getComputedStyle(el).cursor;
    if (cursor === "pointer") return true;
  } catch {}
  return false;
}

function buildAccessibilityTree(maxElements) {
  const results = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (NOISE_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
        if (!isElementVisible(node)) return NodeFilter.FILTER_REJECT;
        const role = inferRole(node);
        if (role || isInteractive(node)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let count = 0;
  while (walker.nextNode() && count < maxElements) {
    const el = walker.currentNode;
    const role = inferRole(el) || "generic";
    const name = getAccessibleName(el);
    const entry = { ref: count + 1, role, name };

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      entry.value = el.value || undefined;
    }
    if (el.disabled) entry.disabled = true;
    if (el.checked !== undefined && el.type !== "text")
      entry.checked = el.checked;
    if (el.getAttribute("aria-expanded") !== null)
      entry.expanded = el.getAttribute("aria-expanded") === "true";

    const level = el.tagName.match(/^H(\d)$/);
    if (level) entry.level = parseInt(level[1]);

    if (el.href) entry.url = el.href;

    results.push(entry);
    count++;
  }
  return results;
}

function createAnnotations() {
  clearAnnotations();

  const container = document.createElement("div");
  container.id = "__mcp_annotations";
  container.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(container);
  annotationContainer = container;

  const elements = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (NOISE_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
        if (!isElementVisible(node)) return NodeFilter.FILTER_REJECT;
        if (isInteractive(node)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  while (walker.nextNode() && elements.length < MAX_A11Y_ELEMENTS) {
    elements.push(walker.currentNode);
  }

  let refId = 1;
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const badge = document.createElement("div");
    badge.style.cssText = `
      position:fixed;
      left:${Math.max(0, rect.left - 2)}px;
      top:${Math.max(0, rect.top - 2)}px;
      min-width:16px;
      height:16px;
      background:#e53e3e;
      color:#fff;
      font-size:10px;
      font-weight:bold;
      line-height:16px;
      text-align:center;
      padding:0 3px;
      border-radius:3px;
      font-family:monospace;
      pointer-events:none;
    `;
    badge.textContent = String(refId);
    container.appendChild(badge);
    annotationMap.set(refId, el);
    refId++;
  }

  return { count: annotationMap.size };
}

function clearAnnotations() {
  if (annotationContainer) {
    annotationContainer.remove();
    annotationContainer = null;
  }
  annotationMap.clear();
}

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

    case "dom.accessibilityTree": {
      const maxElements = params.maxElements || MAX_A11Y_ELEMENTS;
      const tree = buildAccessibilityTree(maxElements);
      let output = tree
        .map((entry) => {
          let line = `[@${entry.ref}] ${entry.role}`;
          if (entry.level) line += ` (level ${entry.level})`;
          if (entry.name) line += ` "${entry.name}"`;
          if (entry.value !== undefined) line += ` value="${entry.value}"`;
          if (entry.checked !== undefined)
            line += entry.checked ? " [checked]" : " [unchecked]";
          if (entry.disabled) line += " [disabled]";
          if (entry.expanded !== undefined)
            line += entry.expanded ? " [expanded]" : " [collapsed]";
          if (entry.url) line += ` -> ${entry.url}`;
          return line;
        })
        .join("\n");
      if (output.length > MAX_A11Y_OUTPUT) {
        output = output.slice(0, MAX_A11Y_OUTPUT) + "\n... (truncated)";
      }
      return output;
    }

    case "capture.annotate": {
      return createAnnotations();
    }

    case "capture.clearAnnotations": {
      clearAnnotations();
      return null;
    }

    case "interaction.clickAnnotation": {
      const el = annotationMap.get(params.ref);
      if (!el)
        throw new Error(
          `Annotation ref @${params.ref} not found. Run annotate_page first.`,
        );
      el.scrollIntoView({ behavior: "instant", block: "center" });
      el.click();
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return null;
    }

    case "interaction.typeAnnotation": {
      const el = annotationMap.get(params.ref);
      if (!el)
        throw new Error(
          `Annotation ref @${params.ref} not found. Run annotate_page first.`,
        );
      el.focus();
      if (params.clear !== false) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const nativeSetter =
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set ||
        Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
      const newValue = (params.clear !== false ? "" : el.value) + params.text;
      if (nativeSetter) {
        nativeSetter.call(el, newValue);
      } else {
        el.value = newValue;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return null;
    }

    case "interaction.selectOption": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      if (el.tagName !== "SELECT")
        throw new Error(`Element is not a <select>: ${params.selector}`);

      let optionFound = false;
      for (const option of el.options) {
        if (
          (params.value !== undefined && option.value === params.value) ||
          (params.label !== undefined &&
            option.textContent.trim() === params.label) ||
          (params.index !== undefined && option.index === params.index)
        ) {
          el.value = option.value;
          optionFound = true;
          break;
        }
      }
      if (!optionFound) throw new Error("No matching option found in <select>");

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return null;
    }

    case "interaction.check": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      const type = el.type?.toLowerCase();
      if (type !== "checkbox" && type !== "radio")
        throw new Error(
          `Element is not a checkbox or radio: ${params.selector}`,
        );

      const desired = params.checked !== false;
      if (el.checked !== desired) {
        el.checked = desired;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return null;
    }

    case "dom.formValues": {
      const form = document.querySelector(params.selector);
      if (!form) throw new Error(`Element not found: ${params.selector}`);
      if (form.tagName !== "FORM")
        throw new Error(`Element is not a <form>: ${params.selector}`);

      const data = {};
      const formData = new FormData(form);
      for (const [key, value] of formData.entries()) {
        if (data[key] !== undefined) {
          if (!Array.isArray(data[key])) data[key] = [data[key]];
          data[key].push(value);
        } else {
          data[key] = value;
        }
      }
      return data;
    }

    case "wait.selector": {
      const selector = params.selector;
      const timeout = params.timeout || 10000;
      const requireVisible = params.visible === true;

      const existing = document.querySelector(selector);
      if (existing && (!requireVisible || isElementVisible(existing))) {
        return { found: true, tag: existing.tagName.toLowerCase() };
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(
            new Error(
              `Timed out waiting for selector "${selector}" after ${timeout}ms`,
            ),
          );
        }, timeout);

        const observer = new MutationObserver(() => {
          const el = document.querySelector(selector);
          if (el && (!requireVisible || isElementVisible(el))) {
            observer.disconnect();
            clearTimeout(timer);
            resolve({ found: true, tag: el.tagName.toLowerCase() });
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "style", "hidden"],
        });
      });
    }

    case "monitor.consoleLogs": {
      const level = params.level || "all";
      const limit = params.limit || MAX_CONSOLE_BUFFER;
      let logs = consoleBuffer;
      if (level !== "all") {
        logs = logs.filter((entry) => entry.level === level);
      }
      return logs.slice(-limit);
    }

    case "monitor.pageErrors": {
      const limit = params.limit || MAX_ERROR_BUFFER;
      return errorBuffer.slice(-limit);
    }

    case "wait.networkIdle": {
      const timeout = params.timeout || 10000;
      const idleTime = params.idleTime || 500;

      return new Promise((resolve, reject) => {
        let idleTimer = null;
        let lastActivity = Date.now();

        const timeoutTimer = setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Network did not become idle within ${timeout}ms`));
        }, timeout);

        const observer = new PerformanceObserver(() => {
          lastActivity = Date.now();
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            observer.disconnect();
            clearTimeout(timeoutTimer);
            resolve({ idleAt: Date.now() });
          }, idleTime);
        });

        observer.observe({ type: "resource", buffered: false });

        idleTimer = setTimeout(() => {
          observer.disconnect();
          clearTimeout(timeoutTimer);
          resolve({ idleAt: Date.now() });
        }, idleTime);
      });
    }

    case "capture.metrics": {
      const nav = performance.getEntriesByType("navigation")[0] || {};
      const resources = performance.getEntriesByType("resource");
      return {
        navigation: {
          domContentLoaded: nav.domContentLoadedEventEnd,
          load: nav.loadEventEnd,
          domInteractive: nav.domInteractive,
          responseEnd: nav.responseEnd,
          transferSize: nav.transferSize,
        },
        resources: {
          count: resources.length,
          totalTransferSize: resources.reduce(
            (sum, r) => sum + (r.transferSize || 0),
            0,
          ),
        },
        dom: {
          elementCount: document.querySelectorAll("*").length,
          title: document.title,
          url: location.href,
        },
      };
    }

    case "storage.get": {
      const storageType =
        params.type === "session" ? sessionStorage : localStorage;
      if (params.key) {
        return { [params.key]: storageType.getItem(params.key) };
      }
      const data = {};
      for (let i = 0; i < storageType.length; i++) {
        const key = storageType.key(i);
        data[key] = storageType.getItem(key);
      }
      return data;
    }

    case "storage.set": {
      const storageType =
        params.type === "session" ? sessionStorage : localStorage;
      storageType.setItem(params.key, params.value);
      return null;
    }

    case "storage.clear": {
      const storageType =
        params.type === "session" ? sessionStorage : localStorage;
      storageType.clear();
      return null;
    }

    case "capture.highlight": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      const rect = el.getBoundingClientRect();
      const color = params.color || "rgba(229, 62, 62, 0.3)";
      const duration = params.duration || 3000;

      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position:fixed;
        left:${rect.left}px;
        top:${rect.top}px;
        width:${rect.width}px;
        height:${rect.height}px;
        background:${color};
        border:2px solid rgba(229, 62, 62, 0.8);
        z-index:2147483647;
        pointer-events:none;
        transition:opacity 0.3s;
      `;
      document.documentElement.appendChild(overlay);
      setTimeout(() => {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 300);
      }, duration);
      return null;
    }

    case "capture.elementRect": {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      el.scrollIntoView({ behavior: "instant", block: "center" });
      await new Promise((r) => setTimeout(r, 100));
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        devicePixelRatio: window.devicePixelRatio,
      };
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
