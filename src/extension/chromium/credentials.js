const cApi = typeof browser !== "undefined" ? browser : chrome;
const STORAGE_KEY = "credentials_encrypted";

let masterPassword = null;
let credentials = []; // decrypted in-memory list

// ── DOM refs ───────────────────────────────────────────────────────────

const $unlock = document.getElementById("unlock-section");
const $main = document.getElementById("main-section");
const $masterPw = document.getElementById("master-password");
const $btnUnlock = document.getElementById("btn-unlock");
const $btnLock = document.getElementById("btn-lock");
const $btnShowAdd = document.getElementById("btn-show-add");
const $addForm = document.getElementById("add-form");
const $formTitle = document.getElementById("form-title");
const $editIndex = document.getElementById("edit-index");
const $alias = document.getElementById("f-alias");
const $url = document.getElementById("f-url");
const $username = document.getElementById("f-username");
const $password = document.getElementById("f-password");
const $notes = document.getElementById("f-notes");
const $btnSave = document.getElementById("btn-save");
const $btnCancelAdd = document.getElementById("btn-cancel-add");
const $credList = document.getElementById("cred-list");
const $btnShowCsv = document.getElementById("btn-show-csv");
const $csvSection = document.getElementById("csv-section");
const $csvFile = document.getElementById("csv-file");
const $btnImportCsv = document.getElementById("btn-import-csv");
const $btnCancelCsv = document.getElementById("btn-cancel-csv");
const $csvPreview = document.getElementById("csv-preview");
const $csvPreviewText = document.getElementById("csv-preview-text");
const $btnExportCsv = document.getElementById("btn-export-csv");
const $toast = document.getElementById("toast");

// ── Toast ──────────────────────────────────────────────────────────────

function showToast(msg, type = "success") {
  $toast.textContent = msg;
  $toast.className = `toast show ${type}`;
  setTimeout(() => ($toast.className = "toast"), 2500);
}

// ── Storage helpers ────────────────────────────────────────────────────

async function loadFromStorage() {
  return new Promise((resolve) => {
    cApi.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

async function saveToStorage(encrypted) {
  return new Promise((resolve) => {
    cApi.storage.local.set({ [STORAGE_KEY]: encrypted }, resolve);
  });
}

async function saveCredentials() {
  const encrypted = await __cryptoUtils.encryptData(
    masterPassword,
    credentials,
  );
  await saveToStorage(encrypted);
}

// ── Unlock / Lock ──────────────────────────────────────────────────────

$btnUnlock.addEventListener("click", unlock);
$masterPw.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
});

async function unlock() {
  const pw = $masterPw.value.trim();
  if (!pw) return;

  const stored = await loadFromStorage();

  if (stored) {
    try {
      credentials = await __cryptoUtils.decryptData(pw, stored);
    } catch {
      showToast("Wrong master password", "error");
      return;
    }
  } else {
    // First time — create empty store
    credentials = [];
  }

  masterPassword = pw;
  // Save immediately (creates store on first use)
  await saveCredentials();

  $unlock.classList.add("hidden");
  $main.classList.remove("hidden");
  renderList();
}

$btnLock.addEventListener("click", () => {
  masterPassword = null;
  credentials = [];
  $main.classList.add("hidden");
  $unlock.classList.remove("hidden");
  $masterPw.value = "";
  hideForm();
  hideCsv();
});

// ── Credential list rendering ──────────────────────────────────────────

function renderList() {
  if (credentials.length === 0) {
    $credList.innerHTML =
      '<p style="color: #8b949e; text-align: center; padding: 32px;">No credentials saved yet.</p>';
    return;
  }

  $credList.innerHTML = credentials
    .map(
      (c, i) => `
    <div class="cred-item">
      <div class="cred-info">
        <div class="cred-alias">${esc(c.alias)}</div>
        ${c.url ? `<div class="cred-url">${esc(c.url)}</div>` : ""}
        <div class="cred-user">${esc(c.username)}</div>
      </div>
      <div class="cred-actions">
        <button class="btn-secondary" onclick="editCredential(${i})">Edit</button>
        <button class="btn-danger" onclick="deleteCredential(${i})">Delete</button>
      </div>
    </div>`,
    )
    .join("");
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ── Add / Edit form ────────────────────────────────────────────────────

$btnShowAdd.addEventListener("click", () => {
  $formTitle.textContent = "Add Credential";
  $editIndex.value = "-1";
  $alias.value = "";
  $url.value = "";
  $username.value = "";
  $password.value = "";
  $notes.value = "";
  $addForm.classList.remove("hidden");
  hideCsv();
  $alias.focus();
});

$btnCancelAdd.addEventListener("click", hideForm);

function hideForm() {
  $addForm.classList.add("hidden");
}

window.editCredential = function (idx) {
  const c = credentials[idx];
  if (!c) return;
  $formTitle.textContent = "Edit Credential";
  $editIndex.value = String(idx);
  $alias.value = c.alias;
  $url.value = c.url || "";
  $username.value = c.username;
  $password.value = c.password;
  $notes.value = c.notes || "";
  $addForm.classList.remove("hidden");
  $alias.focus();
};

window.deleteCredential = async function (idx) {
  if (!confirm(`Delete credential "${credentials[idx].alias}"?`)) return;
  credentials.splice(idx, 1);
  await saveCredentials();
  renderList();
  showToast("Credential deleted");
};

$btnSave.addEventListener("click", async () => {
  const alias = $alias.value.trim();
  const username = $username.value.trim();
  const password = $password.value;
  if (!alias || !username || !password) {
    showToast("Alias, username, and password are required", "error");
    return;
  }

  const entry = {
    alias,
    username,
    password,
    url: $url.value.trim() || undefined,
    notes: $notes.value.trim() || undefined,
  };

  const editIdx = parseInt($editIndex.value, 10);
  if (editIdx >= 0) {
    credentials[editIdx] = entry;
  } else {
    // Check for duplicate alias
    const existing = credentials.findIndex((c) => c.alias === alias);
    if (existing >= 0) {
      if (!confirm(`Credential "${alias}" already exists. Overwrite?`)) return;
      credentials[existing] = entry;
    } else {
      credentials.push(entry);
    }
  }

  await saveCredentials();
  renderList();
  hideForm();
  showToast(editIdx >= 0 ? "Credential updated" : "Credential saved");
});

// ── CSV Import ─────────────────────────────────────────────────────────

$btnShowCsv.addEventListener("click", () => {
  $csvSection.classList.remove("hidden");
  $csvPreview.classList.add("hidden");
  $csvFile.value = "";
  hideForm();
});

$btnCancelCsv.addEventListener("click", hideCsv);

function hideCsv() {
  $csvSection.classList.add("hidden");
}

// Known column name mappings for various password managers
const ALIAS_COLS = ["alias", "name", "title", "entry", "label"];
const USERNAME_COLS = ["username", "login", "user", "email", "login_username"];
const PASSWORD_COLS = ["password", "pass", "login_password"];
const URL_COLS = ["url", "uri", "website", "login_uri"];
const NOTES_COLS = ["notes", "note", "comments", "extra"];

function findColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCSV(text) {
  const rows = [];
  let fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      fields.push(current);
      current = "";
      if (fields.length > 0) {
        rows.push(fields);
        fields = [];
      }
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      current += ch;
    }
  }
  fields.push(current);
  if (fields.some((f) => f.trim() !== "")) {
    rows.push(fields);
  }
  return rows;
}

$csvFile.addEventListener("change", () => {
  const file = $csvFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const rows = parseCSV(text);
    if (rows.length < 2) {
      $csvPreviewText.textContent = "CSV has no data rows.";
      $csvPreview.classList.remove("hidden");
      return;
    }

    const headers = rows[0];
    const aliasIdx = findColumn(headers, ALIAS_COLS);
    const userIdx = findColumn(headers, USERNAME_COLS);
    const passIdx = findColumn(headers, PASSWORD_COLS);

    if (userIdx < 0 || passIdx < 0) {
      $csvPreviewText.textContent = `Could not find username/password columns. Headers found: ${headers.join(", ")}`;
      $csvPreview.classList.remove("hidden");
      return;
    }

    const dataCount = rows.length - 1;
    $csvPreviewText.textContent = `Found ${dataCount} credential(s). Alias: "${headers[aliasIdx] || "auto-generated"}", Username: "${headers[userIdx]}", Password: "${headers[passIdx]}".`;
    $csvPreview.classList.remove("hidden");
  };
  reader.readAsText(file);
});

$btnImportCsv.addEventListener("click", async () => {
  const file = $csvFile.files[0];
  if (!file) {
    showToast("Select a CSV file first", "error");
    return;
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    showToast("CSV has no data rows", "error");
    return;
  }

  const headers = rows[0];
  const aliasIdx = findColumn(headers, ALIAS_COLS);
  const userIdx = findColumn(headers, USERNAME_COLS);
  const passIdx = findColumn(headers, PASSWORD_COLS);
  const urlIdx = findColumn(headers, URL_COLS);
  const notesIdx = findColumn(headers, NOTES_COLS);

  if (userIdx < 0 || passIdx < 0) {
    showToast("Cannot find username/password columns", "error");
    return;
  }

  let imported = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const username = (row[userIdx] || "").trim();
    const password = row[passIdx] || "";
    if (!username && !password) continue;

    let alias = aliasIdx >= 0 ? (row[aliasIdx] || "").trim() : "";
    if (!alias) {
      // Generate alias from URL or row number
      const url = urlIdx >= 0 ? (row[urlIdx] || "").trim() : "";
      try {
        alias = url ? new URL(url).hostname.replace("www.", "") : `import-${i}`;
      } catch {
        alias = `import-${i}`;
      }
    }

    const entry = {
      alias,
      username,
      password,
      url: urlIdx >= 0 ? (row[urlIdx] || "").trim() || undefined : undefined,
      notes:
        notesIdx >= 0 ? (row[notesIdx] || "").trim() || undefined : undefined,
    };

    // Overwrite duplicates
    const existing = credentials.findIndex((c) => c.alias === alias);
    if (existing >= 0) {
      credentials[existing] = entry;
    } else {
      credentials.push(entry);
    }
    imported++;
  }

  await saveCredentials();
  renderList();
  hideCsv();
  showToast(`Imported ${imported} credential(s)`);
});

// ── CSV Export ──────────────────────────────────────────────────────────

$btnExportCsv.addEventListener("click", () => {
  if (credentials.length === 0) {
    showToast("No credentials to export", "error");
    return;
  }

  const header = "alias,username,password,url,notes";
  const rows = credentials.map((c) =>
    [c.alias, c.username, c.password, c.url || "", c.notes || ""]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "browser-control-credentials.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported to CSV");
});
