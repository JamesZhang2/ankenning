// @ts-check
// Stable fields for extra definition languages. Append new languages; never reorder or rename fields.
// All fields exist even when unused, so changing the selection keeps the same Anki note type schema.
export const FALLBACK_LANGUAGES = /** @type {const} */ ([
  'en', 'de', 'nl', 'sv', 'zh', 'ja', 'vi', 'ko', 'es', 'fr', 'pt', 'it',
  'ru', 'pl', 'uk', 'sr', 'ga', 'gd', 'ar', 'tr', 'el', 'hu', 'hy',
]);

/** @param {string} code */
export const fallbackField = (code) => `Translation_${code}`;
