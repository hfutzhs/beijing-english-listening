const { EdgeTTS } = require('node-edge-tts');
const fs = require('fs');
const path = require('path');

const FEMALE_VOICE = 'en-US-JennyNeural';
const MALE_VOICE = 'en-US-GuyNeural';
const SINGLE_VOICE = 'en-US-AriaNeural';
const RATE_DIALOGUE = '-15%';
const RATE_RETELL = '-18%';
const RATE_PASSAGE = '-15%';

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'audio');

function extractScriptsFromTS() {
  const ts = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'questions.ts'), 'utf-8');
  const objScriptRegex = /\{\s*script:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;

  const lcSection = ts.split('const lcSeeds')[1]?.split('const laSeeds')[0] || '';
  const lcScripts = [];
  while ((m = objScriptRegex.exec(lcSection)) !== null) lcScripts.push(m[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));

  const laSection = ts.split('const laSeeds')[1]?.split('const lrSeeds')[0] || '';
  const laScripts = [];
  objScriptRegex.lastIndex = 0;
  while ((m = objScriptRegex.exec(laSection)) !== null) laScripts.push(m[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));

 const lrSection = ts.split('const lrSeeds')[1]?.split('const raSeeds')[0] || '';
 const lrScripts = [];
 const lrRegex = /script:\s*"((?:[^"\\]|\\.)*)"/g;
 while ((m = lrRegex.exec(lrSection)) !== null) lrScripts.push(m[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));

  const raSection = ts.split('const raSeeds')[1]?.split('// ====')[0] || '';
  const raRegex = /\{\s*passage:\s*"((?:[^"\\]|\\.)*)"/g;
  const raScripts = [];
  while ((m = raRegex.exec(raSection)) !== null) raScripts.push(m[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));

  console.log('Seeds: ' + lcScripts.length + ' LC, ' + laScripts.length + ' LA, ' + lrScripts.length + ' LR, ' + raScripts.length + ' RA');

  const scripts = new Map();
  let id = 1;
  for (let paper = 1; paper <= 21; paper++) {
    for (let i = 0; i < 6; i++) {
      const idx = ((paper - 1) * 6 + i) % lcScripts.length;
      scripts.set(id++, { text: lcScripts[idx], type: 'dialogue' });
    }
    for (let i = 0; i < 6; i++) {
      const idx = ((paper - 1) * 6 + i) % laScripts.length;
      scripts.set(id++, { text: laScripts[idx], type: 'dialogue' });
    }
    scripts.set(id++, { text: lrScripts[(paper - 1) % lrScripts.length], type: 'retell' });
    scripts.set(id++, { text: raScripts[(paper - 1) % raScripts.length], type: 'passage' });
  }
  return scripts;
}

function splitDialogue(text) {
  const parts = [];
  const regex = /([WMF]):\s*/g;
  let lastIndex = 0, lastSpeaker = null, match;
  while ((match = regex.exec(text)) !== null) {
    if (lastSpeaker) parts.push({ speaker: lastSpeaker, text: text.substring(lastIndex, match.index).trim() });
    lastSpeaker = match[1];
    lastIndex = regex.lastIndex;
  }
  if (lastSpeaker) parts.push({ speaker: lastSpeaker, text: text.substring(lastIndex).trim() });
  return parts;
}

async function genSegment(text, voice, rate, audioPath) {
  const tts = new EdgeTTS({ voice, lang: 'en-US', rate: rate, timeout: 30000 });
  await tts.ttsPromise(text, audioPath);
}

function concatFiles(files, outputPath) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outputPath);
    ws.on('finish', resolve);
    ws.on('error', reject);
    for (const f of files) ws.write(fs.readFileSync(f));
    ws.end();
  });
}

async function genQuestion(qid, info) {
  const outPath = path.join(OUTPUT_DIR, qid + '.mp3');
  if (fs.existsSync(outPath)) return;
  const text = info.text;
  const parts = splitDialogue(text);

  const rate = info.type === 'retell' ? RATE_RETELL : info.type === 'passage' ? RATE_PASSAGE : RATE_DIALOGUE;
  if (parts.length > 1 && info.type === 'dialogue') {
    const segFiles = [];
    for (let i = 0; i < parts.length; i++) {
      const voice = parts[i].speaker === 'M' ? MALE_VOICE : FEMALE_VOICE;
      const segPath = path.join(OUTPUT_DIR, qid + '_s' + i + '.mp3');
      await genSegment(parts[i].text, voice, rate, segPath);
      segFiles.push(segPath);
    }
    await concatFiles(segFiles, outPath);
    segFiles.forEach(f => { try { fs.unlinkSync(f); } catch(e){} });
  } else {
    const voice = info.type === 'passage' ? SINGLE_VOICE : FEMALE_VOICE;
    await genSegment(text, voice, rate, outPath);
  }
}

async function main() {
  console.log('=== Audio Generation ===');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const scripts = extractScriptsFromTS();
  console.log('Total questions: ' + scripts.size);

  let ok = 0, fail = 0;
  for (const [qid, info] of scripts) {
    if (fs.existsSync(path.join(OUTPUT_DIR, qid + '.mp3'))) { ok++; continue; }
    try {
      process.stdout.write('[' + qid + '/' + scripts.size + '] ');
      await genQuestion(qid, info);
      const sz = (fs.statSync(path.join(OUTPUT_DIR, qid + '.mp3')).size / 1024).toFixed(1);
      console.log('OK ' + sz + 'KB');
      ok++;
    } catch (e) {
      console.error('FAIL: ' + e.message);
      fail++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log('\nDone: ' + ok + ' ok, ' + fail + ' failed');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
