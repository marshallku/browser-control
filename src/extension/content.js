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
                    text: text.length > MAX_ELEMENT_TEXT ? text.slice(0, MAX_ELEMENT_TEXT) + "..." : text,
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
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
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
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value",
            )?.set || Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                "value",
            )?.set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(el, (params.clear !== false ? "" : el.value) + params.text);
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
            const target = params.selector ? document.querySelector(params.selector) : document.activeElement;
            if (!target) throw new Error(params.selector ? `Element not found: ${params.selector}` : "No active element");
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
