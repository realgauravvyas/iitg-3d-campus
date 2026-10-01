// Writes FEATURES.md from the very same catalogue the game's Guide (F1) and Info panel (I) read
// (src/guide/data.js), so the repository's feature list and the in-game guide never disagree.
//   node tools/gen-features.mjs        (npm run features)
// The unit tests import render() and fail when FEATURES.md is out of date.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { CATEGORIES, TOPICS, STATUS, statusCounts } from '../src/guide/data.js';

const ICON = { works: '✅', partial: '🟡', no: '❌' };
const strip = (t) => String(t ?? '').replace(/<kbd[^>]*>(.*?)<\/kbd>/g, '`$1`').replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\|/g, '\\|');
const keys = (k) => (k ? String(k).split('|').map((c) => `\`${c}\``).join(' ') : '');

/** the text of FEATURES.md */
export function render() {
  const total = statusCounts(null);
  const lines = [];
  lines.push('# IITG 3D: features');
  lines.push('');
  lines.push('Every place, thing and system in the game, what you can do there, and what works only in part or not at all.');
  lines.push('This file is generated from the in-game catalogue (`src/guide/data.js`): press **F1** in the game for the same guide, searchable, and **I** for the entry of whatever you are near.');
  lines.push('');
  lines.push(`**${total.works}** features work · **${total.partial}** work in part · **${total.no}** are not in the game (${TOPICS.filter((t) => !t.auto).length} entries).`);
  lines.push('');
  lines.push('| Symbol | Meaning |');
  lines.push('|---|---|');
  for (const k of ['works', 'partial', 'no']) lines.push(`| ${ICON[k]} | ${STATUS[k].label} |`);
  lines.push('');
  lines.push('## Contents');
  lines.push('');
  for (const c of CATEGORIES) {
    const ts = TOPICS.filter((t) => t.cat === c.id && !t.auto);
    if (!ts.length) continue;
    lines.push(`- **${c.name}**: ${ts.map((t) => `[${t.name}](#${t.id})`).join(' · ')}`);
  }
  lines.push('');
  for (const c of CATEGORIES) {
    const ts = TOPICS.filter((t) => t.cat === c.id && !t.auto);
    if (!ts.length) continue;
    lines.push(`## ${c.name}`);
    lines.push('');
    lines.push(`_${c.blurb}._`);
    lines.push('');
    for (const t of ts) {
      lines.push(`<a id="${t.id}"></a>`);
      lines.push(`### ${t.name}`);
      lines.push('');
      if (t.kicker) lines.push(`_${strip(t.kicker)}_${t.hours ? ` · ${strip(t.hours)}` : ''}`);
      else if (t.hours) lines.push(`_${strip(t.hours)}_`);
      if (t.kicker || t.hours) lines.push('');
      lines.push(strip(t.blurb));
      lines.push('');
      if (t.feats?.length) {
        lines.push('| | What you can do | Keys | Note |');
        lines.push('|---|---|---|---|');
        for (const [s, text, k, note] of t.feats) lines.push(`| ${ICON[s]} | ${strip(text)} | ${keys(k)} | ${strip(note || '')} |`);
        lines.push('');
      }
      if (t.has?.length) { lines.push(`**What is there:** ${t.has.join(' · ')}`); lines.push(''); }
      if (t.tips?.length) { for (const tip of t.tips) lines.push(`> ${strip(tip)}`); lines.push(''); }
    }
  }
  lines.push('## Everything that does not work');
  lines.push('');
  lines.push('The same list the game shows under “What does not work”.');
  lines.push('');
  for (const t of TOPICS) {
    const fs = (t.feats || []).filter((f) => f[0] !== 'works');
    if (!fs.length) continue;
    lines.push(`- **${t.name}**`);
    for (const [s, text, , note] of fs) lines.push(`  - ${ICON[s]} ${strip(text)}${note ? ` — ${strip(note)}` : ''}`);
  }
  lines.push('');
  return lines.join('\n');
}

// run directly: write the file
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  writeFileSync(path.join(ROOT, 'FEATURES.md'), render());
  const total = statusCounts(null);
  console.log(`FEATURES.md written: ${TOPICS.filter((t) => !t.auto).length} entries, ${total.works + total.partial + total.no} features`);
}
