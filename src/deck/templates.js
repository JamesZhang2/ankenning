// @ts-check
// The note type for a config (ARCHITECTURE §7.1): fixed fields, two templates, card.css verbatim.
//   Forward: learned word → translation. Rows placed on Front go to the question, rows on Back after
//            <hr id=answer>. Japanese uses WordRuby on the question only when Reading = Front, and on
//            the answer whenever Reading ≠ Off.
//   Reverse: translation → learned word. The question is wrapped in {{#Reverse}}…{{/Reverse}}, so Anki
//            makes the card only when the Reverse field is filled. Every row about the learned word goes
//            to the answer; only the translation and concept rows placed on Front (POS, register, emoji)
//            stay on the question. Type the answer adds {{type:TypeTarget}} to both sides.
//   Audio:   on both forward faces and the reverse answer (ARCHITECTURE §7.1).
// Captions come from labels.json in the known language. data-field / data-dir / data-side let the site
// tell which field a selection came from (feedback reports). In a deck with a right-to-left language every block
// also says its direction (fields.js: learn.attrs, know.attrs), captions and the typed answer included.

import { typesAnswer } from '../state.js';
import { escapeHtml } from '../text/html.js';
import { FIELD_NAMES, langTag } from './fields.js';
import { fallbackField } from './fallbacks.js';
import { pairLabel } from './names.js';

/** @typedef {import('./fields.js').DeckContext} DeckContext */

/**
 * Field-table rows shown as sections, in display order: [row id, field, CSS class, caption key].
 * @type {[string, string, string, string | null][]}
 */
const ROWS = [
  ['romanization', 'Romanization', 'rom', 'section.romanization'],
  ['otherScript', 'OtherScript', 'other', 'section.otherScript'],
  ['measureWord', 'MeasureWord', 'mw', 'section.measureWord'],
  ['hanja', 'Hanja', 'hanja', 'section.hanja'],
  ['forms', 'Forms', 'forms', 'section.forms'],
  ['ipa', 'IPA', 'ipa', 'section.ipa'],
  ['examples', 'Examples', 'examples', 'section.examples'],
  ['related', 'Related', 'related', 'section.related'],
  ['etymology', 'Etymology', 'etym', 'section.etymology'],
  ['pos', 'POS', 'tag pos', null],
  ['register', 'Register', 'tag reg', null],
  ['emoji', 'Emoji', 'emoji', null],
  ['conceptId', 'ConceptId', 'cid', 'section.conceptId'],
];

/** @param {DeckContext} ctx @param {string} row */
const sideOf = (ctx, row) => ctx.meta.fields.fields.find((/** @type {any} */ f) => f.id === row)?.side;

/** What a measure-word row is called: a counter in Japanese, a classifier in Vietnamese. @type {Record<string, string>} */
const MEASURE_CAPTION = { ja: 'section.counter', vi: 'section.classifier' };

/** Join template blocks on separate lines, skipping sections that are switched off. @param {...string} parts */
const lines = (...parts) => parts.filter(Boolean).join('\n');

/** Indent HTML and Anki conditional sections for the card template editor. @param {string} open @param {string} body @param {string} close */
const wrap = (open, body, close) => `${open}\n${body.split('\n').map((line) => `  ${line}`).join('\n')}\n${close}`;

/** @param {string} field @param {string} body */
const conditional = (field, body) => wrap(`{{#${field}}}`, body, `{{/${field}}}`);

/**
 * A conditional section, shown only when the field is not empty.
 * @param {DeckContext} ctx @param {string} row @param {string} field @param {string} cls @param {string | null} captionKey
 */
function section(ctx, row, field, cls, captionKey) {
  const key = (row === 'measureWord' && MEASURE_CAPTION[ctx.learn.code]) || captionKey;
  const caption = key ? `<div class="cap"${ctx.bidi ? ctx.know.attrs : ''}>${escapeHtml(ctx.label(key) ?? '')}</div>` : '';
  const lang = sideOf(ctx, row) === 'learning' ? ctx.learn.attrs : ctx.know.attrs;
  return conditional(field, wrap(`<div class="sec ${cls}">`, lines(caption, `<div class="val"${lang} data-field="${field}">{{${field}}}</div>`), '</div>'));
}

/** @param {DeckContext} ctx @param {(row: string, placement: string) => boolean} pick */
function sections(ctx, pick) {
  return ROWS.filter(([row]) => pick(row, ctx.place(row))).map(([row, field, cls, cap]) => section(ctx, row, field, cls, cap)).join('\n');
}

/** @param {DeckContext} ctx @param {boolean} ruby */
function word(ctx, ruby) {
  const field = ruby ? 'WordRuby' : 'Word';
  return lines(
    `<div class="word"${ctx.learn.attrs} data-field="${field}">{{${field}}}</div>`,
    conditional('Disambig', `<div class="disambig"${ctx.know.attrs} data-field="Disambig">{{Disambig}}</div>`),
  );
}

/** @param {DeckContext} ctx @param {string} cls */
function translation(ctx, cls) {
  const fallbacks = ctx.config.fallbackLanguages.map((code) => {
    const reg = ctx.meta.languages.languages[code];
    const field = fallbackField(code);
    const tag = langTag(reg, code, ctx.config.srScript);
    const dir = reg?.dir === 'rtl' ? 'rtl' : 'ltr';
    // Native details/summary works in Anki's webviews and the sandboxed preview, without scripts.
    return conditional(field, wrap('<details class="fallback">', lines(
      `<summary lang="${tag}" dir="${dir}">${escapeHtml(reg?.native ?? code)}</summary>`,
      `<div class="translation" lang="${tag}" dir="${dir}" data-field="${field}">{{${field}}}</div>`,
    ), '</details>'));
  }).join('\n');
  return lines(`<div class="${cls}"${ctx.know.attrs} data-field="Translation">{{Translation}}</div>`, fallbacks);
}

/** @param {string} dir @param {string} side @param {string} body */
const card = (dir, side, body) => wrap(`<div class="ag ag-${dir}" data-dir="${dir}" data-side="${side}">`, body, '</div>');

/**
 * @param {DeckContext} ctx
 * @param {string} css  css/card.css, embedded verbatim
 */
export function noteType(ctx, css) {
  const ja = ctx.learn.code === 'ja';
  const reading = ja ? ctx.place('reading') : 'off';
  const type = typesAnswer(ctx.config);
  const isEmoji = (/** @type {string} */ row) => row === 'emoji';
  const learningRow = (/** @type {string} */ row) => sideOf(ctx, row) === 'learning';

  const audio = ctx.audio ? conditional('Audio', '<div class="audio" data-field="Audio">{{Audio}}</div>') : '';

  // Forward: emoji (if on the front) above the word, other Front rows below it.
  const fwdQuestion = (/** @type {boolean} */ ruby, sound = '') =>
    lines(sections(ctx, (row, p) => isEmoji(row) && p === 'front'), word(ctx, ruby), sound, sections(ctx, (row, p) => !isEmoji(row) && p === 'front'));
  const forwardFront = card('forward', 'front', fwdQuestion(reading === 'front', audio));
  const forwardBack = card(
    'forward',
    'back',
    lines(fwdQuestion(reading !== 'off', audio), '<hr id=answer>', translation(ctx, 'translation'), sections(ctx, (_, p) => p === 'back')),
  );

  // Reverse: only the translation and concept rows placed on Front ask the question.
  const revQuestion = lines(
    sections(ctx, (row, p) => isEmoji(row) && p === 'front'),
    translation(ctx, 'translation prompt'),
    sections(ctx, (row, p) => !isEmoji(row) && !learningRow(row) && p === 'front'),
  );
  const typeBox = type ? `<div class="typeans"${ctx.bidi ? ctx.learn.attrs : ''}>{{type:TypeTarget}}</div>` : '';
  const reverseFront = conditional('Reverse', card('reverse', 'front', lines(revQuestion, typeBox)));
  const reverseBack = card(
    'reverse',
    'back',
    lines(revQuestion, '<hr id=answer>', typeBox, word(ctx, reading !== 'off'), audio,
      sections(ctx, (row, p) => (learningRow(row) ? p !== 'off' : p === 'back'))),
  );

  return {
    name: `Ankenning ${pairLabel(ctx.meta, ctx.config)}`,
    fields: [...FIELD_NAMES],
    sortField: 0,
    templates: [
      { name: 'Forward', qfmt: forwardFront, afmt: forwardBack },
      { name: 'Reverse', qfmt: reverseFront, afmt: reverseBack },
    ],
    css,
  };
}

/** @typedef {ReturnType<typeof noteType>} NoteType */
