import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, encodeHash, decodeHash, saveConfig, loadConfig } from '../src/state.js';
import { FIELD_NAMES } from '../src/deck/fields.js';
import { FALLBACK_LANGUAGES } from '../src/deck/fallbacks.js';
import { renderCard } from '../src/deck/render.js';
import { createApp } from '../src/ui/app.js';
import { createLoader } from '../src/data/loader.js';
import { buildDeck } from '../src/deck/deck.js';
import { fixtureDeck, fixtureLoader, readJsonFile, readTextFile } from './helpers/fixtures.mjs';
import { loadMeta } from './helpers/meta.mjs';

const meta = loadMeta();

test('fallback languages are validated, canonical, shareable and saved; old links still work', () => {
  const config = validate({ learn: 'fr', know: 'es', fallbackLanguages: ['sr', 'es', 'en', 'fr', 'en', 'xx', '='] }, meta);
  assert.deepEqual(config.fallbackLanguages, ['en', 'sr']);
  assert.equal(encodeHash(config, meta), '#v1&l=fr&k=es&kl=en,sr&x=2&sr=c');
  assert.deepEqual(decodeHash(encodeHash(config, meta), meta), config);
  let saved = '';
  saveConfig({ setItem: (_, value) => { saved = value; } }, config, meta);
  assert.deepEqual(loadConfig({ storage: { getItem: () => saved } }, meta), config);
  assert.deepEqual(decodeHash('#v1&l=fr&k=es', meta)?.fallbackLanguages, []);
  assert.deepEqual(validate({ ...config, learn: 'en' }, meta).fallbackLanguages, ['sr']);
  assert.deepEqual(validate({ ...config, know: 'en' }, meta).fallbackLanguages, ['sr']);
  assert.deepEqual(validate({ ...config, know: null }, meta).fallbackLanguages, []);
  assert.deepEqual(validate({ ...config, fallbackLanguages: 'en' }, meta).fallbackLanguages, []);
  assert.deepEqual(validate({ ...config, know: '=' }, meta).fallbackLanguages, ['en', 'sr']);
  assert.deepEqual(new Set(FALLBACK_LANGUAGES), new Set(meta.languages.active));
});

test('each fallback has its own field, merged meanings, hints, glosses and script handling', async () => {
  const deck = await fixtureDeck({ learn: 'ru', know: 'de', fallbackLanguages: ['en', 'sr'], srScript: 'latn' });
  const hand = deck.notes.find((n) => n.key === 'word-hand');
  assert.equal(hand?.fields.Translation_en, '<span class="m">hand;</span> <span class="m">arm</span>');
  assert.match(deck.notes.find((n) => n.key === 'word-water')?.fields.Translation_sr ?? '', /voda/);
  assert.equal(hand?.fields.Translation_ja, '');
  assert.deepEqual(deck.noteType.fields, [...FIELD_NAMES]);
  const gloss = await fixtureDeck({ learn: 'ja', know: 'de', fallbackLanguages: ['en'] });
  assert.match(gloss.notes.find((n) => n.key === 'word-residence-record-jp')?.fields.Translation_en ?? '', /<i class="gl">/);
  const hints = await fixtureDeck({ learn: 'en', know: 'de', fallbackLanguages: ['ru'] });
  assert.match(hints.notes.find((n) => n.key === 'word-brother-older')?.fields.Translation_ru ?? '', /брат.*старший/);
});

test('fallbacks start collapsed wherever the primary translation appears; no answer leaks onto the forward question', async () => {
  const deck = await fixtureDeck({ learn: 'ja', know: 'de', fallbackLanguages: ['en', 'sr'], reverse: true });
  const note = deck.notes.find((n) => n.key === 'word-water');
  assert.ok(note);
  const forward = renderCard(deck.noteType, note.fields, 0);
  const reverse = renderCard(deck.noteType, note.fields, 1);
  assert.ok(forward && reverse);
  assert.doesNotMatch(forward.front, /water|Translation_en|<details/);
  for (const face of [forward.back, reverse.front, reverse.back]) {
    assert.match(face, /<details class="fallback"><summary lang="en-US" dir="ltr">English<\/summary><div class="translation" lang="en-US" dir="ltr" data-field="Translation_en">water<\/div><\/details>/);
    assert.doesNotMatch(face, /<details[^>]*\bopen\b/);
  }
  const ordinary = await fixtureDeck({ learn: 'ja', know: 'de' });
  assert.deepEqual(deck.noteType.fields, ordinary.noteType.fields, 'toggling fallback languages does not change the schema');
  assert.deepEqual(deck.notes.map((n) => n.key), ordinary.notes.map((n) => n.key), 'fallbacks do not change note selection or identity');
});

test('missing fallback entries render no empty reveal control; same-language primary definitions still work', async () => {
  const deck = await fixtureDeck({ learn: 'ja', know: '=', fallbackLanguages: ['en', 'es'] });
  const note = deck.notes.find((n) => n.key === 'word-water');
  assert.ok(note);
  assert.equal(note.fields.Translation_es, '', 'Spanish is absent in the small fixture');
  assert.ok(note.fields.Translation);
  assert.equal(note.fields.Translation_en, 'water');
  const back = renderCard(deck.noteType, note.fields, 0)?.back ?? '';
  assert.match(back, /Translation_en/);
  assert.doesNotMatch(back, /Translation_es|Español/);
});

test('a download waits for fallback data; the preview and export receive the same fields', async () => {
  const loader = fixtureLoader();
  const original = loader.getLanguage;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  loader.getLanguage = async (code) => {
    if (code === 'en') await gate;
    return original(code);
  };
  const app = createApp({ loader, meta, initial: validate({ learn: 'ja', know: 'de', modules: ['core-1'], fallbackLanguages: ['en'] }, meta) });
  await Promise.all([original('ja'), original('de')]);
  assert.equal(app.view().ready, false);
  assert.equal(app.deckInput(), null);
  release();
  await app.settled();
  assert.equal(app.view().ready, true);
  const deck = buildDeck(app.deckInput());
  assert.equal(deck.notes.find((n) => n.key === 'word-water')?.fields.Translation_en, 'water');
});

test('real French deck uses Spanish primarily and English as a hidden fallback', async () => {
  const loader = createLoader({ fetchJson: readJsonFile, fetchText: readTextFile, dataDir: 'data' });
  const app = createApp({ loader, meta, initial: validate({ learn: 'fr', know: 'es', fallbackLanguages: ['en'], modules: ['core-1'], reverse: true, audio: true }, meta) });
  await app.settled();
  const input = app.deckInput();
  assert.ok(input);
  const deck = buildDeck(input);
  const water = deck.notes.find((n) => n.conceptIds.includes('word-water'));
  assert.ok(water);
  assert.equal(water.fields.Translation, 'agua');
  assert.equal(water.fields.Translation_en, 'water');
  assert.match(water.fields.Audio, /^\[sound:ankigen-fr-/);
  const front = renderCard(deck.noteType, water.fields, 0)?.front ?? '';
  const back = renderCard(deck.noteType, water.fields, 0)?.back ?? '';
  assert.doesNotMatch(front, /agua|water/);
  assert.match(back, /data-field="Translation">agua<\/div><details/);
  assert.match(back, /data-field="Translation_en">water/);
});
