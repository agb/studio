const appsJson = document.querySelector("#apps-json");
const copyButton = document.querySelector("#copy-json");
const jsonMeta = document.querySelector("#json-meta");
const ROOT_FIELDS = ["$schema", "version", "apps"];
const APP_FIELDS = [
  "id",
  "name",
  "description",
  "platforms",
  "status",
  "url",
  "legal",
];
const LEGAL_FIELDS = ["privacyPolicy", "termsOfService"];
const VALID_PLATFORMS = new Set(["Web", "iOS", "Android"]);
const VALID_STATUSES = new Set(["active", "closed", "coming_soon"]);
let rawJson = "";

function assert(condition, message) {
  if (!condition) {
    throw new TypeError(message);
  }
}

function assertExactFields(value, fields, path) {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${path} must be an object.`
  );

  const keys = Object.keys(value);
  const hasExactFields =
    keys.length === fields.length && fields.every((field) => keys.includes(field));

  assert(hasExactFields, `${path} must contain exactly: ${fields.join(", ")}.`);
}

function assertNonEmptyString(value, path) {
  assert(
    typeof value === "string" && value.trim().length > 0,
    `${path} must be a non-empty string.`
  );
}

function assertNullableUrl(value, path) {
  assert(
    value === null || (typeof value === "string" && value.trim().length > 0),
    `${path} must be a URL string or null.`
  );

  if (typeof value === "string") {
    try {
      new URL(value, document.baseURI);
    } catch {
      throw new TypeError(`${path} must be a valid URL.`);
    }
  }
}

function validateCatalog(catalog) {
  assertExactFields(catalog, ROOT_FIELDS, "catalog");
  assert(catalog.$schema === "./apps.schema.json", "catalog.$schema is invalid.");
  assert(catalog.version === 1, "catalog.version must be 1.");
  assert(Array.isArray(catalog.apps), "catalog.apps must be an array.");
  assert(catalog.apps.length > 0, "catalog.apps must not be empty.");

  const ids = new Set();

  catalog.apps.forEach((app, index) => {
    const path = `catalog.apps[${index}]`;
    assertExactFields(app, APP_FIELDS, path);
    assertNonEmptyString(app.id, `${path}.id`);
    assert(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app.id),
      `${path}.id must be kebab-case.`
    );
    assert(!ids.has(app.id), `${path}.id must be unique.`);
    ids.add(app.id);

    assertNonEmptyString(app.name, `${path}.name`);
    assertNonEmptyString(app.description, `${path}.description`);
    assert(
      Array.isArray(app.platforms) && app.platforms.length > 0,
      `${path}.platforms must be a non-empty array.`
    );
    assert(
      new Set(app.platforms).size === app.platforms.length &&
        app.platforms.every((platform) => VALID_PLATFORMS.has(platform)),
      `${path}.platforms contains an invalid or duplicate platform.`
    );
    assert(VALID_STATUSES.has(app.status), `${path}.status is invalid.`);
    assertNullableUrl(app.url, `${path}.url`);
    assert(
      app.status === "active" ? typeof app.url === "string" : app.url === null,
      `${path}.url does not match its status.`
    );

    assertExactFields(app.legal, LEGAL_FIELDS, `${path}.legal`);
    assertNullableUrl(app.legal.privacyPolicy, `${path}.legal.privacyPolicy`);
    assertNullableUrl(app.legal.termsOfService, `${path}.legal.termsOfService`);
  });

  return catalog;
}

function highlightJson(json) {
  const escapedJson = json
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return escapedJson.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:|"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (token) => {
      let type = "number";

      if (token.startsWith('"')) {
        const isKey = token.trimEnd().endsWith(":");
        const status = token.slice(1, -1);

        if (!isKey && VALID_STATUSES.has(status)) {
          type = `status-${status.replace("_", "-")}`;
        } else {
          type = isKey ? "key" : "string";
        }
      } else if (token === "true" || token === "false") {
        type = "boolean";
      } else if (token === "null") {
        type = "null";
      }

      return `<span class="json-${type}">${token}</span>`;
    }
  );
}

function showJson(value) {
  rawJson = JSON.stringify(value, null, 2);
  appsJson.innerHTML = highlightJson(rawJson);
}

async function renderApps() {
  try {
    const response = await fetch("apps.json");

    if (!response.ok) {
      throw new Error(`Could not load apps.json (${response.status})`);
    }

    const catalog = validateCatalog(await response.json());
    showJson(catalog);
    jsonMeta.textContent = `${catalog.apps.length} apps · schema v${catalog.version}`;
    copyButton.disabled = false;
  } catch (error) {
    console.error(error);
    showJson({ error: "apps.json failed schema validation." });
    jsonMeta.textContent = "Invalid schema";
  }
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(rawJson);
    copyButton.textContent = "Copied";

    window.setTimeout(() => {
      copyButton.textContent = "Copy JSON";
    }, 1600);
  } catch (error) {
    console.error(error);
    copyButton.textContent = "Copy failed";
  }
});

renderApps();
