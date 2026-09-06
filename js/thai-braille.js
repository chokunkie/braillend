/* =========================================================================
   BrailBox - Thai Braille transliteration engine
   -------------------------------------------------------------------------
   Turns a Unicode string (Thai, Latin, digits, mixed) into a stream of
   braille CELLS following Thai Braille orthography.

   Public API
   ----------
     textToBrailleCells(text)            -> Cell[]      (variable length, never padded)
     paginateBrailleCells(cells, perPage) -> Page[]     (Page = { cells, text })

   Cell = {
     dots:       number[]   ascending raised dots 1..6; [] = blank / space / unknown
     source:     string     grapheme(s) this cell came from ("ก", "เ–ือ", "1")
     kind:       'consonant'|'vowel'|'tone'|'mark'|'digit'|'latin'|
                 'indicator'|'space'|'punct'|'unknown'
     char:       string     alias of `source`  (back-compat with old cell shape)
     activeDots: number[]   alias of `dots`    (back-compat with old cell shape)
   }

   STAGING NOTE
   -----------
   This file currently does a faithful CHARACTER-BY-CHARACTER transliteration
   (correct cells, but 1 input codepoint -> 1 cell, print order preserved).
   Syllable reordering, compound-vowel folding, reduced สระโอะ and word
   spacing are layered in by later stages; the API and Cell shape above are
   already their final form so downstream code never changes again.
   ========================================================================= */

(function (global) {
    'use strict';

    var T = (typeof require === 'function')
        ? require('./thai-braille-tables.js')
        : (global.THAI_BRAILLE_TABLES || (typeof THAI_BRAILLE_TABLES !== 'undefined' ? THAI_BRAILLE_TABLES : null));

    if (!T) {
        // Degrade instead of throwing (a throw would abort every later inline
        // <script>). Downstream callers already handle a missing engine.
        console.error('thai-braille.js: thai-braille-tables.js did not load first - emitting blank cells');
        T = {
            THAI_CONSONANTS: {}, THAI_SIMPLE_VOWELS: {}, THAI_COMPOUND_VOWELS: {},
            THAI_RU_LU: {}, THAI_TONES: {}, THAI_MARKS: {},
            BRAILLE_INDICATORS: { number: { cells: [[3, 4, 5, 6]] }, capital: { cells: [[6]] } },
            DIGITS: {}, THAI_DIGITS: {}, LATIN_LETTERS: {}, PUNCTUATION: {}
        };
    }

    /* ----- Unicode classes ---------------------------------------------- */
    var RE_THAI        = /[฀-๿]/;
    var isConsonant    = function (ch) { return !!(ch && (T.THAI_CONSONANTS[ch])); };
    var isLeadVowel    = function (ch) { return ch === 'เ' || ch === 'แ' || ch === 'โ' || ch === 'ใ' || ch === 'ไ'; };
    var isAboveBelow   = function (ch) { return 'ัิีึืฺุู็ํ'.indexOf(ch) !== -1; }; // ั ิ ี ึ ื ฺ ุ ู ็ ํ
    var isTone         = function (ch) { return '่้๊๋'.indexOf(ch) !== -1; };
    var isThanthakhat  = function (ch) { return ch === '์'; };
    var isTrailVowel   = function (ch) { return ch === 'ะ' || ch === 'า' || ch === 'ำ' || ch === 'ๅ'; };

    // Valid Thai initial consonant clusters (อักษรควบ) + ห-นำ + อ-นำ.
    var CLUSTERS = (function () {
        var s = {};
        ['กร', 'กล', 'กว', 'ขร', 'ขล', 'ขว', 'คร', 'คล', 'คว', 'ตร', 'ปร', 'ปล',
         'ผล', 'พร', 'พล', 'ผร', 'บร', 'บล', 'ดร', 'ฟร', 'ฟล', 'ทร', 'จร', 'สร',
         'ศร', 'หง', 'หญ', 'หน', 'หม', 'หย', 'หร', 'หล', 'หว', 'หฬ', 'อย'
        ].forEach(function (c) { s[c] = true; });
        return s;
    })();

    /* ----- helpers ------------------------------------------------------- */

    // A lone Thai above/below vowel or tone mark (ั ิ ี ึ ื ฺ ุ ู ็ ่ ้ ๊ ๋ ์ ํ ๎)
    // has no base consonant to attach to, so a renderer that just drops it
    // into a <span> shows nothing (or a stray floating glyph). Prefix a
    // dotted circle - the same notation the reference chart uses ("สระ ◌ิ") -
    // so the cell label reads as an actual character. `source` stays the raw
    // grapheme (used for the OLED text line and speech); `label` is display-only.
    var RE_BARE_COMBINING_MARK = /^[ัิ-ฺ็-๎]$/;
    function displayLabel(source) {
        return (typeof source === 'string' && RE_BARE_COMBINING_MARK.test(source))
            ? '◌' + source
            : source;
    }

    function cell(dots, source, kind) {
        var d = (dots || []).slice().sort(function (a, b) { return a - b; });
        return {
            dots: d, source: source, kind: kind,
            char: source, activeDots: d,
            label: displayLabel(source)
        };
    }

    // Expand a table entry ({cells:[[..],[..]]}) into Cell objects.
    function cellsFromEntry(entry, source, kind) {
        var out = [];
        var groups = entry.cells || [];
        for (var i = 0; i < groups.length; i++) {
            out.push(cell(groups[i], i === 0 ? source : '', groups.length > 1 ? kind : kind));
        }
        if (out.length) { out[0].source = source; }
        return out;
    }

    /* ----- lookups (single grapheme) ----------------------------------- */
    function lookupChar(ch) {
        if (T.THAI_CONSONANTS[ch])      { return cellsFromEntry(T.THAI_CONSONANTS[ch], ch, 'consonant'); }
        if (T.THAI_SIMPLE_VOWELS[ch])   { return cellsFromEntry(T.THAI_SIMPLE_VOWELS[ch], ch, 'vowel'); }
        if (T.THAI_TONES[ch])           { return cellsFromEntry(T.THAI_TONES[ch], ch, 'tone'); }
        if (T.THAI_MARKS[ch])           { return cellsFromEntry(T.THAI_MARKS[ch], ch, 'mark'); }
        if (T.THAI_RU_LU[ch])           { return cellsFromEntry(T.THAI_RU_LU[ch], ch, 'vowel'); }
        if (T.PUNCTUATION[ch]) {
            var p = T.PUNCTUATION[ch];
            return cellsFromEntry(p, ch, p.kind || 'punct');
        }
        return null;
    }

    /* ----- script-run classification --------------------------------- */
    function scriptOf(ch) {
        if (ch === ' ') { return 'space'; }
        if (/[0-9]/.test(ch) || T.THAI_DIGITS[ch]) { return 'digit'; }
        if (/[A-Za-z]/.test(ch)) { return 'latin'; }
        if (RE_THAI.test(ch)) { return 'thai'; }
        return 'other';
    }

    /* ----- per-run emitters ----------------------------------------- */
    function emitDigitRun(run, out) {
        out.push(cell(T.BRAILLE_INDICATORS.number.cells[0], '#', 'indicator'));
        for (var i = 0; i < run.length; i++) {
            var ch = run[i];
            var key = T.THAI_DIGITS[ch] || ch;
            var entry = T.DIGITS[key];
            if (entry) { out.push(cell(entry.cells[0], ch, 'digit')); }
            else { out.push(cell([], ch, 'unknown')); }
        }
    }

    function emitLatinRun(run, out) {
        for (var i = 0; i < run.length; i++) {
            var ch = run[i];
            var lower = ch.toLowerCase();
            var groups = T.LATIN_LETTERS[lower];
            if (!groups) { out.push(cell([], ch, 'unknown')); continue; }
            if (ch !== lower) {
                out.push(cell(T.BRAILLE_INDICATORS.capital.cells[0], '', 'indicator'));
            }
            out.push(cell(groups[0], ch, 'latin'));
        }
    }

    /* ================================================================
       Thai run -> syllables -> braille cells (Stage 3)
       Keeps bare leading vowels (เ แ โ ใ ไ) before the initial consonant.
       Multi-part vowel units are emitted after the initial consonant, while
       final consonants and tone marks retain their Thai Braille order.
       ================================================================ */

    // Resolve a vowel from its written parts to braille cell groups.
    // Returns number[][] (cell groups) or null when there is no vowel.
    function resolveVowel(lead, above, trail) {
        lead = lead || ''; above = above || ''; trail = trail || '';
        var pieces = [];
        if (lead) { pieces.push(lead); }
        Array.prototype.push.apply(pieces, Array.from(above));
        Array.prototype.push.apply(pieces, Array.from(trail));
        if (pieces.length === 0) { return null; }

        // สระ ◌ัว ลดรูป (ว with no written ◌ั): canonicalise to ◌ัว
        if (!lead && !above && trail === 'ว' && T.THAI_COMPOUND_VOWELS['อัว']) {
            return T.THAI_COMPOUND_VOWELS['อัว'].cells;
        }

        // 1. dedicated compound-vowel cell (canonical key uses 'อ' for the consonant)
        var key = lead + 'อ' + above + trail;
        if (T.THAI_COMPOUND_VOWELS[key]) { return T.THAI_COMPOUND_VOWELS[key].cells; }

        // 2. single simple vowel
        if (pieces.length === 1) {
            var p = pieces[0];
            if (T.THAI_SIMPLE_VOWELS[p]) { return T.THAI_SIMPLE_VOWELS[p].cells; }
        }

        // 3. best-effort fallback: each piece's own cell, vowel-parts then lead
        var groups = [];
        function addSimple(ch) {
            var e = T.THAI_SIMPLE_VOWELS[ch];
            if (e) { Array.prototype.push.apply(groups, e.cells); }
        }
        Array.from(above).forEach(addSimple);
        Array.from(trail).forEach(addSimple);
        if (lead) { addSimple(lead); }
        return groups.length ? groups : null;
    }

    function pushEntryCells(out, entry, source, kind) {
        if (!entry) { out.push(cell([], source, 'unknown')); return; }
        var groups = entry.cells || [];
        for (var i = 0; i < groups.length; i++) {
            out.push(cell(groups[i], i === 0 ? source : '', kind));
        }
    }

    // Parse ONE syllable starting at chars[i]; returns { seg, next }.
    // opts.inDictWord: true when chars is a recognised dictionary word, so the
    // spelling is trustworthy enough to insert reduced สระโอะ freely.
    function nextThaiSegment(chars, i, opts) {
        var inDictWord = !!(opts && opts.inDictWord);
        var start = i;
        var lead = '';
        while (isLeadVowel(chars[i])) { lead += chars[i]; i++; }

        // standalone ฤ ฤๅ ฦ ฦๅ
        if (T.THAI_RU_LU[chars[i]]) {
            var ru = chars[i];
            if (chars[i + 1] === 'ๅ' && T.THAI_RU_LU[ru + 'ๅ']) { ru = ru + 'ๅ'; i += 2; }
            else { i += 1; }
            return { seg: { type: 'ru', ru: ru, lead: lead }, next: i };
        }

        if (!isConsonant(chars[i])) {
            // orphan lead vowel / stray combining mark - emit literally
            var lit = lead || chars[i];
            if (!lead) { i++; }
            return { seg: { type: 'raw', text: lit }, next: i };
        }

        var c1 = chars[i]; i++;
        var c2 = '';
        if (isConsonant(chars[i]) && CLUSTERS[c1 + chars[i]]) {
            // treat as an initial cluster unless the 2nd consonant clearly
            // opens the next syllable (it carries its own vowel and c1 doesn't)
            c2 = chars[i]; i++;
        }

        var above = '', tone = '', midMark = '';
        while (isAboveBelow(chars[i]) || isTone(chars[i])) {
            if (isTone(chars[i])) { tone += chars[i]; }
            else if (chars[i] === '็' || chars[i] === 'ํ') { midMark += chars[i]; }
            else { above += chars[i]; }
            i++;
        }

        // เ◌็◌ / แ◌็◌ have no dedicated braille vowel - Thai Braille writes
        // them character-by-character in print order (no reorder).
        if ((lead === 'เ' || lead === 'แ') && midMark.indexOf('็') !== -1) {
            // rewind: let the raw path handle the whole run from `start`
            var k2 = i;
            while (k2 < chars.length && !isLeadVowel(chars[k2]) &&
                   (isConsonant(chars[k2]) || isAboveBelow(chars[k2]) || isTone(chars[k2]) ||
                    isThanthakhat(chars[k2]) || isTrailVowel(chars[k2]))) {
                // stop before a consonant that starts a new syllable (has its own vowel next)
                if (isConsonant(chars[k2]) && (isAboveBelow(chars[k2 + 1]) || isLeadVowel(chars[k2 + 1]))) { break; }
                k2++;
            }
            return { seg: { type: 'raw', text: chars.slice(start, k2).join('') }, next: k2 };
        }

        var trail = '';
        while (isTrailVowel(chars[i])) { trail += chars[i]; i++; }

        // อ / ว / ย acting as a vowel component (not a final consonant).
        // อ is a vowel piece after an initial when it isn't opening a new
        // syllable: เธอ, ขอ, พ่อ, มือ, คือ, เรือ.
        if (chars[i] === 'อ') {
            var oNext = chars[i + 1];
            var oOpensSyllable = isAboveBelow(oNext) ||
                (isConsonant(oNext) && (isAboveBelow(chars[i + 2]) || isLeadVowel(chars[i + 2])));
            if (!oOpensSyllable) { trail += 'อ'; i++; }
        } else if (chars[i] === 'ว' && above.indexOf('ั') !== -1) {
            trail += 'ว'; i++;                          // ◌ัว written in full
        } else if (chars[i] === 'ว' && !lead && !above && inDictWord &&
                   isConsonant(chars[i + 1]) &&
                   !isAboveBelow(chars[i + 2]) && !isTrailVowel(chars[i + 2]) &&
                   (chars[i + 2] === undefined || chars[i + 2] === ' ' || !RE_THAI.test(chars[i + 2]) ||
                    (isConsonant(chars[i + 2]) && (isAboveBelow(chars[i + 3]) || isLeadVowel(chars[i + 3]))))) {
            trail += 'ว'; i++;                          // สระ ◌ัว ลดรูป: ช่วย, ด้วย, ป่วย
        } else if (chars[i] === 'ย' && lead === 'เ' && above.indexOf('ี') !== -1) { trail += 'ย'; i++; }

        var haveVowel = !!(lead || above || trail);
        var fin = '', finKaran = false, reducedO = false;

        // สระโอะ ลดรูป: a CLOSED syllable with no written vowel is pronounced
        // with โอะ, which Braille writes explicitly (คน -> ค + โอะ + น).
        // Conditions: exactly one final consonant that does NOT itself carry a
        // vowel (else it's อักษรนำ like สนุก), followed by a hard boundary or a
        // new vowelled syllable. Only fire inside a trusted dictionary word, or
        // when the token is a known reduced-โอะ word.
        if (!haveVowel && isConsonant(chars[i]) && !CLUSTERS[c1 + chars[i]]) {
            var finCh = chars[i];
            var a1 = chars[i + 1];   // char after the candidate final
            var finBindsVowel = isAboveBelow(a1) || isTrailVowel(a1) || a1 === 'ั';
            var closes = (a1 === undefined) || (a1 === ' ') || !RE_THAI.test(a1) ||
                isLeadVowel(a1) ||
                (isConsonant(a1) && (isAboveBelow(chars[i + 2]) || isLeadVowel(chars[i + 2])));
            var token = c1 + (c2 || '') + finCh;
            var known = T.REDUCED_O_WORDS &&
                (T.REDUCED_O_WORDS.has ? T.REDUCED_O_WORDS.has(token) : T.REDUCED_O_WORDS[token]);
            if (!finBindsVowel && closes && (inDictWord || known)) {
                fin = finCh; i++;
                reducedO = true;
                if (isThanthakhat(chars[i])) { finKaran = true; i++; }
                while (isTone(chars[i])) { tone += chars[i]; i++; }
            }
        }

        if (isConsonant(chars[i])) {
            var nx = chars[i + 1];
            var opensNext = isAboveBelow(nx) || isLeadVowel(nx) ||
                (isConsonant(nx) && CLUSTERS[chars[i] + nx]);
            if (haveVowel && !opensNext) {
                fin = chars[i]; i++;
                if (isThanthakhat(chars[i])) { finKaran = true; i++; }
                // rare silent cluster ...ร์ / ...ตร์
                if (isConsonant(chars[i]) && isThanthakhat(chars[i + 1])) {
                    fin += chars[i]; finKaran = true; i += 2;
                }
                while (chars[i] === 'ะ' || chars[i] === 'ำ') { trail += chars[i]; i++; }
                while (isTone(chars[i])) { tone += chars[i]; i++; }
                if (isThanthakhat(chars[i])) { finKaran = true; i++; }
            }
        }

        return {
            seg: {
                type: 'syllable',
                lead: lead, c1: c1, c2: c2, above: above, midMark: midMark,
                tone: tone, fin: fin, finKaran: finKaran, trail: trail, reducedO: reducedO,
                raw: chars.slice(start, i).join('')
            },
            next: i
        };
    }

    function emitSyllable(seg, out) {
        var vgroups = resolveVowel(seg.lead, seg.above, seg.trail);
        if (!vgroups && seg.reducedO && T.THAI_COMPOUND_VOWELS['โอะ-ลดรูป']) {
            vgroups = T.THAI_COMPOUND_VOWELS['โอะ-ลดรูป'].cells;
        }

        var vsrc = (seg.lead || '') + (seg.above || '') + (seg.trail || '');
        if (!vsrc && seg.reducedO) { vsrc = 'ะ'; } // implied โอะ - show something on the card

        function emitVowelUnit() {
            if (!vgroups) { return; }
            for (var v = 0; v < vgroups.length; v++) {
                out.push(cell(vgroups[v], v === 0 ? vsrc : '', 'vowel'));
            }
        }

        // Bare leading vowels preserve their written Thai order in Braille.
        // Multi-part forms such as เ◌าะ / เ◌ีย / เ◌ือ are represented by a
        // resolved vowel unit and remain after the initial consonant(s).
        var bareLeadingVowel = !!seg.lead && !seg.above && !seg.trail;
        if (bareLeadingVowel) { emitVowelUnit(); }

        // 1. initial consonant(s)
        pushEntryCells(out, T.THAI_CONSONANTS[seg.c1], seg.c1, 'consonant');
        if (seg.c2) { pushEntryCells(out, T.THAI_CONSONANTS[seg.c2], seg.c2, 'consonant'); }

        // 2. non-leading or multi-part vowel unit
        if (!bareLeadingVowel) { emitVowelUnit(); }

        // 2b. ไม้ไต่คู้ / นิคหิต (short-vowel & nasalisation marks) after the vowel
        var mm = seg.midMark || '';
        for (var m = 0; m < mm.length; m++) {
            pushEntryCells(out, T.THAI_MARKS[mm[m]], mm[m], 'mark');
        }

        // 3. final consonant(s) + karan
        for (var f = 0; f < seg.fin.length; f++) {
            pushEntryCells(out, T.THAI_CONSONANTS[seg.fin[f]], seg.fin[f], 'consonant');
        }
        if (seg.finKaran) { pushEntryCells(out, T.THAI_MARKS['์'], '์', 'mark'); }

        // 4. tone mark(s) LAST
        for (var t = 0; t < seg.tone.length; t++) {
            pushEntryCells(out, T.THAI_TONES[seg.tone[t]], seg.tone[t], 'tone');
        }
    }

    // Forward maximal-matching word segmentation over a Thai run using the
    // bundled dictionary (js/thai-wordlist.js). Unknown stretches are merged
    // into one "fragment" token (under-segment rather than mis-split).
    function segmentWords(run) {
        var WL = global.THAI_WORDLIST ||
            (typeof THAI_WORDLIST !== 'undefined' ? THAI_WORDLIST : null);
        if (!WL || !WL.set) { return [{ text: run, isWord: false }]; }
        var chars = Array.from(run);
        var n = chars.length;
        var result = [];
        var pending = '';
        function flush() { if (pending) { result.push({ text: pending, isWord: false }); pending = ''; } }
        var i = 0;
        while (i < n) {
            var hi = Math.min(WL.maxLen, n - i), matched = '';
            for (var L = hi; L >= 2; L--) {
                var cand = chars.slice(i, i + L).join('');
                if (!WL.set.has(cand)) { continue; }
                // Reject a match that would strand a combining mark (tone /
                // above-below vowel / thanthakhat / ะ ำ) at the start of the
                // remainder - that means we cut inside a syllable.
                var after = chars[i + L];
                if (after !== undefined) {
                    if (isTone(after) || isAboveBelow(after) || isThanthakhat(after) ||
                        after === 'ะ' || after === 'ำ' || after === 'ๅ') { continue; }
                    // Don't cut between two consonants that form an initial
                    // cluster (เบ|รลล์ -> the บ-ร belongs together).
                    if (CLUSTERS[cand.charAt(cand.length - 1) + after]) { continue; }
                }
                matched = cand; break;
            }
            if (matched) {
                flush();
                result.push({ text: matched, isWord: true });
                i += Array.from(matched).length;
            } else {
                pending += chars[i]; i++;
            }
        }
        flush();
        var tokens = collapseAmbiguousShortMatches(result.length ? result : [{ text: run, isWord: false }]);
        return finalizeSegmentation(tokens, run);
    }

    // OCR delivers a whole line as one spaceless Thai run. Splitting that run
    // into "words" is only safe when it clearly decomposes into a PHRASE:
    // every piece is a real dictionary word AND at least one is substantial
    // (>= 4 characters). A run with any unresolved fragment, or made only of
    // 2-3 char dictionary substrings, is kept as a single unit - it is far
    // more likely one word or a name (พิตต้า -> "พิต"+"ต้า", ฐิติพร, สมชาย)
    // than a genuine multi-word phrase, and a space invented mid-name is a
    // hard error for a Braille reader (a blank cell means "next word").
    function finalizeSegmentation(tokens, run) {
        if (tokens.length <= 1) { return tokens; }
        var allWords = tokens.every(function (t) { return t.isWord; });
        var hasSubstantial = tokens.some(function (t) {
            return Array.from(t.text).length >= 4;
        });
        if (allWords && hasSubstantial) { return tokens; }
        return [{ text: run, isWord: false }];
    }

    // A short (<=2 char) dictionary match sitting directly next to text the
    // dictionary couldn't resolve at all is more likely a coincidental
    // substring of one unknown word/name (ฐิติพร -> "ติ" and "พร" both
    // happen to be real words on their own) than a genuine word starting or
    // ending right there. Merge it into the adjacent unmatched fragment
    // instead of treating it as its own word - under-segmenting (no space)
    // is the safer failure mode for Braille output than inventing a space
    // in the middle of a name. Repeats until stable, since a merge can
    // create a new fragment-adjacency on the other side.
    function collapseAmbiguousShortMatches(tokens) {
        var changed = true;
        while (changed) {
            changed = false;
            for (var i = 0; i < tokens.length; i++) {
                var t = tokens[i];
                if (!t.isWord || Array.from(t.text).length > 2) { continue; }
                var prev = tokens[i - 1];
                var next = tokens[i + 1];
                if (prev && !prev.isWord) {
                    prev.text += t.text;
                    tokens.splice(i, 1);
                    changed = true;
                    break;
                }
                if (next && !next.isWord) {
                    t.isWord = false;
                    t.text = t.text + next.text;
                    tokens.splice(i + 1, 1);
                    changed = true;
                    break;
                }
            }
        }
        return tokens;
    }

    function emitThaiWord(text, isWord, out) {
        var chars = Array.from(text);
        var i = 0;
        while (i < chars.length) {
            var r = nextThaiSegment(chars, i, { inDictWord: isWord });
            var seg = r.seg;
            if (r.next <= i) { out.push(cell([], chars[i], 'unknown')); i++; continue; }
            i = r.next;
            if (seg.type === 'syllable') {
                emitSyllable(seg, out);
            } else if (seg.type === 'ru') {
                if (seg.lead) {
                    Array.from(seg.lead).forEach(function (lc) {
                        pushEntryCells(out, T.THAI_SIMPLE_VOWELS[lc], lc, 'vowel');
                    });
                }
                pushEntryCells(out, T.THAI_RU_LU[seg.ru], seg.ru, 'vowel');
            } else { // raw
                Array.from(seg.text).forEach(function (rc) {
                    var cs = lookupChar(rc);
                    if (cs) { out.push.apply(out, cs); }
                    else { out.push(cell([], rc, 'unknown')); }
                });
            }
        }
    }

    function emitThaiRun(run, out) {
        var words = segmentWords(run);
        for (var w = 0; w < words.length; w++) {
            if (w > 0) { out.push(cell([], ' ', 'space')); } // Thai Braille separates words
            emitThaiWord(words[w].text, words[w].isWord, out);
        }
    }

    function emitOtherRun(run, out) {
        var chars = Array.from(run);
        for (var i = 0; i < chars.length; i++) {
            var ch = chars[i];
            var cells = lookupChar(ch);
            if (cells) { out.push.apply(out, cells); }
            else { out.push(cell([], ch, 'unknown')); }
        }
    }

    /* ----- main API ------------------------------------------------- */
    function textToBrailleCells(text) {
        if (text == null) { return []; }
        var s;
        try { s = String(text).normalize('NFC'); }
        catch (e) { s = String(text); }

        var chars = Array.from(s);
        var out = [];
        var i = 0;
        while (i < chars.length) {
            var kind = scriptOf(chars[i]);
            var j = i;
            var buf = '';
            while (j < chars.length && scriptOf(chars[j]) === kind) {
                buf += chars[j];
                j++;
            }
            if (kind === 'space') {
                for (var k = 0; k < buf.length; k++) { out.push(cell([], ' ', 'space')); }
            } else if (kind === 'digit') {
                emitDigitRun(buf, out);
            } else if (kind === 'latin') {
                emitLatinRun(buf, out);
            } else if (kind === 'thai') {
                emitThaiRun(buf, out);
            } else {
                emitOtherRun(buf, out);
            }
            i = j;
        }
        return out;
    }

    function paginateBrailleCells(cells, perPage) {
        perPage = perPage || 14;
        cells = cells || [];
        var pages = [];
        for (var i = 0; i < cells.length; i += perPage) {
            var slice = cells.slice(i, i + perPage);
            pages.push({
                cells: slice,
                text: slice.map(function (c) { return c.source || ''; }).join('')
            });
        }
        if (pages.length === 0) { pages.push({ cells: [], text: '' }); }
        return pages;
    }

    var api = {
        textToBrailleCells: textToBrailleCells,
        paginateBrailleCells: paginateBrailleCells,
        // exposed for tests / future stages
        _scriptOf: scriptOf,
        _lookupChar: lookupChar
    };

    global.ThaiBraille = api;
    global.textToBrailleCells = textToBrailleCells;
    global.paginateBrailleCells = paginateBrailleCells;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
