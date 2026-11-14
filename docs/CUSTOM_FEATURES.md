# Multiple definition languages

Choose the learning language and a primary language under **I speak**, then expand **Fallback definition languages (optional)** and select any extra languages. For your French deck, use Spanish as primary and English as a fallback. “Same language” can also be the primary, with translations as fallbacks.

For local development, run `python3 -m http.server 8000` from the repo and open:

http://localhost:8000/#v1&l=fr&k=es&kl=en&m=core-1&x=2

On forward cards, the answer shows Spanish followed by an **English** disclosure. Click it (or focus it and press Enter/Space) to show or hide English. Reverse cards offer the same disclosure alongside the Spanish question. Every face starts collapsed. The site's preview uses the same HTML and CSS as the exported cards. Native `<details>`/`<summary>` elements provide the interaction without JavaScript in the card templates.

The existing `Translation` field stores the primary meaning. Extra meanings have independent fields such as `Translation_en` and `Translation_es`, which can be edited in Anki. The complete list in `src/deck/fallbacks.js` is appended after the original fields, even when none are selected. Unselected fields stay empty. This keeps the schema stable when changing selections; when adding support for a new language, append its code to that list. Additional languages do not affect deck names, GUIDs, merge sets, note counts, or which concepts are selected. They use the same concept IDs as the primary translation, including merged meanings, hints, synonyms and descriptive glosses. Missing fallback entries produce no disclosure.

Selections are saved locally and in shared links (`kl=en,sr`, for example). The learning language and primary language cannot also be fallbacks. Captions and example translations continue to use the primary language. Serbian script selection applies to Serbian fallbacks too.

**Existing decks:** enable **Merge note types** when first importing this fork's output into an existing collection. The appended fields need to be merged with the original note type. Keep the original primary language when updating a deck: changing the primary language selects a different language pair and therefore a different deck. Re-exporting replaces generated field content, including edits made in Anki, as in the original project.

# How pronunciation audio works

Audio is generated **ahead of time** by `tools/audio.mjs` using Google Cloud Text-to-Speech. The website does not call a TTS API, use browser speech synthesis, or need an API key. Selecting pronunciation audio includes existing MP3 clips in the `.apkg`; Anki can then play them offline.

1. **Configuration:** `data/meta/languages.json` declares TTS locales. `data/meta/audio.json` chooses the voice, tier, format and text rules for each language. French currently uses `fr-FR-Chirp3-HD-Kore`, Spanish uses `es-ES-Chirp3-HD-Kore`, and English uses `en-US-Chirp3-HD-Kore`. These are the voices configured in this repository.
2. **What is spoken:** the learned word's main form under the default card settings, including its article where applicable (French `l’eau`, for example). It does not speak translations, definitions or example sentences. Audio is independent of subsequent display toggles. The generator handles stress marks, Japanese homograph readings and Chinese pinyin specially; see `tools/lib/audio.mjs`.
3. **Generation and caching:** `tools/audio.mjs` reads `GOOGLE_TTS_API_KEY` itself from the environment or `.env`. It chooses an exact-locale Chirp 3 HD voice, otherwise Neural2, otherwise WaveNet. It never substitutes another regional locale. Missing or changed text/voice settings trigger synthesis; identical inputs share a recording. The tool resumes from manifests, limits characters and request rate, retries transient errors, and checks Chirp clips for near-silence.
4. **Storage and delivery:** files live in `data/audio/<code>/`, with a concept-to-file `manifest.json`. `tools/bundle.mjs` groups clips into indexed packs for hosting. `src/data/clips.js` loads the index and fetches the byte ranges needed for a deck (individual MP3s during development).
5. **Export and playback:** `src/deck/fields.js` writes `[sound:ankigen-fr-<hash>.mp3]` into the `Audio` field; `src/ui/audio.js` gathers the media and `src/deck/apkg.js` embeds it. The legacy `ankigen-` prefix prevents media duplication on re-import. The clip appears on the forward question and reverse answer. The forward answer omits it to avoid replaying it. The preview provides a manual play button.

For French → Spanish + English, enabling audio therefore adds **French pronunciation only**. Both translation fields remain text. The project's audio option labels recordings experimental: they are machine generated and unchecked.

Useful commands (generation requires your own Google TTS key and may incur charges):

```sh
node tools/audio.mjs status --lang fr
node tools/audio.mjs estimate --lang fr
node tools/audio.mjs pilot --lang fr
node tools/audio.mjs run --lang fr --max-chars 10000
```

`status` and `estimate` inspect existing data. `pilot` generates a small listening sample and `tmp/audio-pilot.html`; `run` generates missing or changed clips. This feature change does not regenerate audio. See [GENERATION.md §7](GENERATION.md#7-pronunciation-audio) for the full maintenance workflow.
