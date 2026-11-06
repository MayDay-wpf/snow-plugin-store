// snow-plugin-store 条目校验与读取（validate-registry.mjs 与 build-registry.mjs 共用）。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

export const isLocalizedText = (value) => {
  if (isNonEmptyString(value)) {
    return true;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    return (
      entries.length > 0 &&
      entries.every(
        ([key, item]) => key.trim().length > 0 && isNonEmptyString(item),
      )
    );
  }
  return false;
};

const validateEntry = (entry, label, errors) => {
  const id = isNonEmptyString(entry.id) ? entry.id.trim() : "";
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,95}$/.test(id)) {
    errors.push(
      `${label}.id is missing or invalid (letters, digits, dot, dash, underscore; not starting with a dot)`,
    );
  }

  if (
    entry.kind !== undefined &&
    !["plugin", "oauth", "tool", "script"].includes(entry.kind)
  ) {
    errors.push(`${label}.kind must be "plugin", "oauth", "tool" or "script"`);
  }

  if (!isLocalizedText(entry.name)) {
    errors.push(`${label}.name must be a non-empty string or a localized object`);
  }
  if (!isLocalizedText(entry.description)) {
    errors.push(
      `${label}.description must be a non-empty string or a localized object`,
    );
  }
  if (
    !isNonEmptyString(entry.repo) ||
    !/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/.test(entry.repo.trim())
  ) {
    errors.push(`${label}.repo must look like https://github.com/owner/repo`);
  }
  if (!isNonEmptyString(entry.version)) {
    errors.push(`${label}.version is required`);
  }
  if (
    !isNonEmptyString(entry.sha256) ||
    !/^[0-9a-fA-F]{64}$/.test(entry.sha256.trim())
  ) {
    errors.push(`${label}.sha256 must be a 64-character hex string`);
  }

  if (isNonEmptyString(entry.downloadUrl)) {
    if (!/^https:\/\//.test(entry.downloadUrl.trim())) {
      errors.push(`${label}.downloadUrl must use https`);
    }
  } else if (!isNonEmptyString(entry.tag) || !isNonEmptyString(entry.asset)) {
    errors.push(`${label} needs either downloadUrl, or both tag and asset`);
  }

  for (const field of ["privacy", "tags"]) {
    if (entry[field] !== undefined) {
      if (
        !Array.isArray(entry[field]) ||
        !entry[field].every(isNonEmptyString)
      ) {
        errors.push(`${label}.${field} must be an array of non-empty strings`);
      }
    }
  }

  for (const field of [
    "author",
    "homepage",
    "minAppVersion",
    "icon",
    "tag",
    "asset",
    "downloadUrl",
  ]) {
    if (entry[field] !== undefined && typeof entry[field] !== "string") {
      errors.push(`${label}.${field} must be a string`);
    }
  }
};

/** 读取并校验 app/plugins/*.json；返回 { entries, errors }。 */
export const readPluginEntries = (pluginsDir) => {
  const errors = [];
  const entries = [];
  const seenIds = new Set();

  let files;
  try {
    files = readdirSync(pluginsDir)
      .filter((file) => file.endsWith(".json") && !file.startsWith("."))
      .sort();
  } catch (error) {
    return { entries, errors: [`Cannot read ${pluginsDir}: ${error.message}`] };
  }

  for (const file of files) {
    const label = `app/plugins/${file}`;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(pluginsDir, file), "utf8"));
    } catch (error) {
      errors.push(`${label} is not valid JSON: ${error.message}`);
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push(`${label} must contain a JSON object`);
      continue;
    }

    const id = isNonEmptyString(parsed.id) ? parsed.id.trim() : "";
    if (id && file !== `${id}.json`) {
      errors.push(
        `${label}: file name must be "<id>.json" (expected ${id}.json)`,
      );
    }
    if (id) {
      if (seenIds.has(id)) {
        errors.push(`${label}: id "${id}" is duplicated across files`);
      } else {
        seenIds.add(id);
      }
    }

    validateEntry(parsed, label, errors);
    entries.push(parsed);
  }

  return { entries, errors };
};
