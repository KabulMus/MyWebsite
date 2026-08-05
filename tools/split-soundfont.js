/**
 * 拆分钢琴音源 acoustic_grand_piano-mp3.js 为按八度分片的小文件。
 *
 * 产物写入 js/soundfont/ 目录，格式与 midi-js-soundfonts 一致：
 *   MIDI.Soundfont.<name> = { "<note>": "data:audio/mp3;base64,...", ... };
 *
 * 分片说明（piano.js 按此约定按需加载）：
 *   core  = C4~C5（13 音，迷你键盘默认音域，优先加载）
 *   0     = A0~B0（3 音）
 *   1~3   = C1~B1 / C2~B2 / C3~B3（各 12 音）
 *   5     = Db5~B5（11 音，C5 已归入 core）
 *   6~7   = C6~B6 / C7~B7（各 12 音）
 *   8     = C8（1 音）
 *
 * 用法：node tools/split-soundfont.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'js', 'acoustic_grand_piano-mp3.js');
const OUT_DIR = path.join(ROOT, 'js', 'soundfont');

// 分片元数据：key -> { file, var }
const CHUNKS = {
  core: { file: 'acoustic_grand_piano-mp3-C4-C5.js',  var: 'acoustic_grand_piano_C4_C5' },
  '0':   { file: 'acoustic_grand_piano-mp3-A0-B0.js',  var: 'acoustic_grand_piano_A0_B0' },
  '1':   { file: 'acoustic_grand_piano-mp3-C1-B1.js',  var: 'acoustic_grand_piano_C1_B1' },
  '2':   { file: 'acoustic_grand_piano-mp3-C2-B2.js',  var: 'acoustic_grand_piano_C2_B2' },
  '3':   { file: 'acoustic_grand_piano-mp3-C3-B3.js',  var: 'acoustic_grand_piano_C3_B3' },
  '5':   { file: 'acoustic_grand_piano-mp3-Db5-B5.js', var: 'acoustic_grand_piano_Db5_B5' },
  '6':   { file: 'acoustic_grand_piano-mp3-C6-B6.js',  var: 'acoustic_grand_piano_C6_B6' },
  '7':   { file: 'acoustic_grand_piano-mp3-C7-B7.js',  var: 'acoustic_grand_piano_C7_B7' },
  '8':   { file: 'acoustic_grand_piano-mp3-C8.js',     var: 'acoustic_grand_piano_C8' },
};

// 根据键名（如 "Db4"）判断所属分片
function chunkOf(key) {
  const m = key.match(/^([A-G])([b#]?)(\d+)$/);
  if (!m) throw new Error('无法识别的键名: ' + key);
  const oct = parseInt(m[3], 10);
  if (oct === 4) return 'core';
  if (oct === 5) return m[1] === 'C' ? 'core' : '5';
  return String(oct);
}

function main() {
  const src = fs.readFileSync(SRC, 'utf8');

  // 提取所有 "<键名>": "<data uri>" 键值对
  const entries = Array.from(src.matchAll(/"([A-G][b#]?\d+)"\s*:\s*("data:[^"]*")/g));
  if (entries.length !== 88) {
    throw new Error('键值对数量异常: ' + entries.length + '（应为 88）');
  }

  // 按分片归类，保持原文件内的顺序
  const groups = {};
  for (const e of entries) {
    const key = e[1];
    const value = e[2]; // 含引号
    const chunk = chunkOf(key);
    (groups[chunk] = groups[chunk] || []).push({ key, value });
  }

  // 校验每个分片都有数据
  const expected = { core: 13, '0': 3, '1': 12, '2': 12, '3': 12, '5': 11, '6': 12, '7': 12, '8': 1 };
  let total = 0;
  for (const k of Object.keys(CHUNKS)) {
    const list = groups[k] || [];
    if (list.length !== expected[k]) {
      throw new Error(`分片 ${k} 数量异常: ${list.length}（应为 ${expected[k]}）`);
    }
    total += list.length;
  }
  if (total !== 88) throw new Error('总音符数异常: ' + total);

  // 写出分片文件
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sizes = {};
  for (const k of Object.keys(CHUNKS)) {
    const meta = CHUNKS[k];
    const body = groups[k]
      .map(({ key, value }) => `"${key}": ${value},`)
      .join('\n');
    const content =
      `if (typeof(MIDI) === 'undefined') var MIDI = {};\n` +
      `if (typeof(MIDI.Soundfont) === 'undefined') MIDI.Soundfont = {};\n` +
      `MIDI.Soundfont.${meta.var} = {\n` +
      body +
      `\n};\n`;
    const out = path.join(OUT_DIR, meta.file);
    fs.writeFileSync(out, content, 'utf8');
    sizes[k] = Math.round(fs.statSync(out).size / 1024);
  }

  console.log('拆分完成 →', OUT_DIR);
  for (const k of Object.keys(CHUNKS)) {
    const meta = CHUNKS[k];
    const first = groups[k][0].key;
    const last = groups[k][groups[k].length - 1].key;
    console.log(`  [${k.padEnd(4)}] ${String(groups[k].length).padStart(2)} 音  ${first}~${last}  ${sizes[k]} KB  ${meta.file}`);
  }
  console.log('合计:', total, '音');
}

main();
