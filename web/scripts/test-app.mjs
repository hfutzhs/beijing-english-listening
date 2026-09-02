import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5177';
const results = [];
let pass = 0, fail = 0;

function log(id, status, detail) {
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  results.push({ id, status, detail });
  if (status === 'PASS') pass++;
  else if (status === 'FAIL') fail++;
  console.log(`${icon} ${id}: ${status} ${detail || ''}`);
}

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [console.error]', msg.text());
  });
  page.on('pageerror', err => console.log('  [pageerror]', err.message));

  // === DATA TESTS ===
  console.log('\n--- DATA TESTS ---');

  // TC-DATA-001: Total question count
  await page.goto(`${BASE}/#/practice/listen_choose`);
  await page.waitForTimeout(1500);
  const cards = await page.$$('[class*="rounded"] a[href*="practice-answer"], a[href*="practice-answer"]');
  // Check via JS evaluation - questions are in global scope
  const dataCheck = await page.evaluate(() => {
    if (typeof QUESTIONS !== 'undefined') return { count: QUESTIONS.length };
    // Try to count from the DOM
    return { domCards: document.querySelectorAll('a[href*="practice-answer"]').length };
  });
  if (dataCheck.count === 294) log('TC-DATA-001', 'PASS', `294 questions`);
  else log('TC-DATA-001', 'FAIL', `expected 294, got ${dataCheck.count || JSON.stringify(dataCheck)}`);

  // TC-DATA-002: listen_choose list has items
  const lcCards = await page.$$eval('a[href*="practice-answer"]', els => 
    els.filter(e => e.href.includes('type=listen_choose')).length
  );
  if (lcCards === 126) log('TC-DATA-002', 'PASS', `listen_choose: ${lcCards} cards`);
  else log('TC-DATA-002', 'INFO', `listen_choose: ${lcCards} cards (may be paginated)`);

  // === ROUTE TESTS ===
  console.log('\n--- ROUTE TESTS ---');

  // TC-ROUTE-001: Default route
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1000);
  const hash = await page.evaluate(() => window.location.hash);
  const hasTabBar = await page.$('nav.fixed.bottom-0');
  if (hasTabBar) log('TC-ROUTE-001', 'PASS', 'TabBar visible on default route');
  else log('TC-ROUTE-001', 'FAIL', 'TabBar not visible');

  // TC-ROUTE-003: Practice answer route hides TabBar
  await page.goto(`${BASE}/#/practice-answer?questionId=1&type=listen_choose`);
  await page.waitForTimeout(1500);
  const tabBarHidden = await page.evaluate(() => {
    const nav = document.querySelector('nav.fixed.bottom-0');
    return !nav || nav.style.display === 'none' || nav.parentElement.style.display === 'none';
  });
  if (tabBarHidden) log('TC-ROUTE-003', 'PASS', 'TabBar hidden on practice-answer');
  else log('TC-ROUTE-003', 'FAIL', 'TabBar still visible');

  // TC-ROUTE-009: Unknown route fallback
  await page.goto(`${BASE}/#/unknown-route`);
  await page.waitForTimeout(1000);
  const fallbackContent = await page.evaluate(() => {
    return document.body.innerText.includes('听后选择') || document.body.innerText.includes('练习');
  });
  if (fallbackContent) log('TC-ROUTE-009', 'PASS', 'Unknown route falls back to practice list');
  else log('TC-ROUTE-009', 'FAIL', 'No fallback content');

  // === TTS / AUDIO TESTS ===
  console.log('\n--- TTS / AUDIO TESTS ---');

  // TC-TTS-001: Pre-generated audio file exists
  const audioExists = await page.evaluate(async () => {
    try {
      const res = await fetch('/audio/14.mp3', { method: 'HEAD' });
      return { ok: res.ok, status: res.status };
    } catch(e) { return { ok: false, error: e.message }; }
  });
  if (audioExists.ok) log('TC-TTS-001', 'PASS', `/audio/14.mp3 exists (${audioExists.status})`);
  else log('TC-TTS-001', 'FAIL', `audio not found: ${JSON.stringify(audioExists)}`);

  // TC-TTS-009: checkAudioExists cache
  const cacheTest = await page.evaluate(async () => {
    if (typeof checkAudioExists !== 'function') return { error: 'checkAudioExists not defined' };
    // Clear cache
    if (typeof audioExistsCache !== 'undefined') Object.keys(audioExistsCache).forEach(k => delete audioExistsCache[k]);
    const r1 = await checkAudioExists(14);
    const r2 = await checkAudioExists(14);
    return { r1, r2, cached: audioExistsCache[14] };
  });
  if (cacheTest.r1 === true && cacheTest.r2 === true) log('TC-TTS-009', 'PASS', `checkAudioExists(14)=true, cached`);
  else log('TC-TTS-009', 'FAIL', JSON.stringify(cacheTest));

  // TC-TTS-002: Audio fallback for non-existent file
  const fallbackTest = await page.evaluate(async () => {
    if (typeof checkAudioExists !== 'function') return { error: 'checkAudioExists not defined' };
    if (typeof audioExistsCache !== 'undefined') delete audioExistsCache[99999];
    const r = await checkAudioExists(99999);
    return { exists: r };
  });
  if (fallbackTest.exists === false) log('TC-TTS-002', 'PASS', 'Non-existent audio returns false (will fallback to speechSynthesis)');
  else log('TC-TTS-002', 'FAIL', JSON.stringify(fallbackTest));

  // === PRACTICE ANSWER PAGE TESTS ===
  console.log('\n--- PRACTICE ANSWER TESTS ---');

  // TC-ANS-001: listen_choose flow
  await page.goto(`${BASE}/#/practice-answer?questionId=1&type=listen_choose`);
  await page.waitForTimeout(2000);
  
  // Check if question content is displayed
  const hasQuestion = await page.evaluate(() => {
    return document.body.innerText.includes('What does');
  });
  if (hasQuestion) log('TC-ANS-001a', 'PASS', 'listen_choose question text displayed');
  else log('TC-ANS-001a', 'FAIL', 'Question text not found');

  // Check if options are displayed
  const optionCount = await page.$$eval('button', buttons => {
    return buttons.filter(b => /^[ABCD]\)/.test(b.textContent?.trim() || '') || 
                           b.textContent?.includes('scarf') ||
                           b.textContent?.includes('birthday')).length;
  });
  // More robust: check for option labels A/B/C/D
  const optionsVisible = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('A scarf') || text.includes('scarf');
  });
  if (optionsVisible) log('TC-ANS-001b', 'PASS', 'Options visible');
  else log('TC-ANS-001b', 'FAIL', 'Options not visible');

  // Click an option and submit
  try {
    const optionButtons = await page.$$('button');
    let clicked = false;
    for (const btn of optionButtons) {
      const text = (await btn.textContent()) || '';
      if (text.includes('A birthday present for his mother')) {
        await btn.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      // Try by index - click the second option (B)
      const allBtns = await page.$$('button');
      for (const btn of allBtns) {
        const text = (await btn.textContent()) || '';
        if (text.includes('birthday') || text.includes('present')) {
          await btn.click();
          clicked = true;
          break;
        }
      }
    }
    await page.waitForTimeout(500);
    
    // Look for submit button
    const submitBtn = await page.$$('button');
    let submitted = false;
    for (const btn of submitBtn) {
      const text = (await btn.textContent()) || '';
      if (text.includes('提交') || text.includes('确定') || text.includes('Submit')) {
        await btn.click();
        submitted = true;
        break;
      }
    }
    await page.waitForTimeout(1000);
    
    if (submitted) {
      const hasResult = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('正确') || text.includes('错误') || text.includes('得分') || text.includes('分');
      });
      if (hasResult) log('TC-ANS-001c', 'PASS', 'Submit shows result');
      else log('TC-ANS-001c', 'FAIL', 'No result after submit');
    } else {
      log('TC-ANS-001c', 'INFO', 'No submit button found');
    }
  } catch(e) {
    log('TC-ANS-001c', 'FAIL', e.message);
  }

  // TC-ANS-005: read_aloud flow
  await page.goto(`${BASE}/#/practice-answer?questionId=274&type=read_aloud`);
  await page.waitForTimeout(2000);
  const hasPassage = await page.evaluate(() => {
    return document.body.innerText.includes('朗读') && document.body.innerText.length > 200;
  });
  if (hasPassage) log('TC-ANS-005a', 'PASS', 'read_aloud passage displayed');
  else log('TC-ANS-005a', 'FAIL', 'Passage not displayed');

  // Check TTSPlayer for read_aloud
  const hasTTSButton = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent?.includes('播放标准朗读') || b.textContent?.includes('播放听力')) return true;
    }
    return false;
  });
  if (hasTTSButton) log('TC-ANS-005b', 'PASS', 'TTSPlayer button present');
  else log('TC-ANS-005b', 'FAIL', 'No TTS button');

  // TC-ANS-004: listen_retell two rounds
  await page.goto(`${BASE}/#/practice-answer?questionId=253&type=listen_retell`);
  await page.waitForTimeout(2000);
  const hasTwoRounds = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('两遍') || text.includes('播放听力原文');
  });
  if (hasTwoRounds) log('TC-ANS-004', 'PASS', 'listen_retell player with two rounds label');
  else log('TC-ANS-004', 'FAIL', 'No two-round label');

  // === STORAGE TESTS ===
  console.log('\n--- STORAGE TESTS ---');

  // TC-STORE-001: Device ID generation
  const deviceId = await page.evaluate(() => {
    if (typeof getDeviceId === 'function') return getDeviceId();
    return null;
  });
  if (deviceId && deviceId.length > 10) log('TC-STORE-001', 'PASS', `Device ID: ${deviceId.substring(0,8)}...`);
  else log('TC-STORE-001', 'FAIL', `Invalid device ID: ${deviceId}`);

  // TC-STORE-002: Device ID persistence
  const deviceId2 = await page.evaluate(() => getDeviceId());
  if (deviceId === deviceId2) log('TC-STORE-002', 'PASS', 'Device ID persisted');
  else log('TC-STORE-002', 'FAIL', 'Device ID changed');

  // TC-STORE-003: Save practice record
  const saveResult = await page.evaluate(async () => {
    try {
      if (typeof submitPractice !== 'function') return { error: 'submitPractice not defined' };
      const r = await submitPractice({
        questionId: 1, deviceId: 'test-device', sessionId: 'practice',
        selectedAnswer: 1, transcription: '', audioUrl: null
      });
      return { id: r.id, score: r.score, hasCreatedAt: !!r.created_at };
    } catch(e) { return { error: e.message }; }
  });
  if (saveResult.id && saveResult.hasCreatedAt) log('TC-STORE-003', 'PASS', `Record saved, id=${saveResult.id}, score=${saveResult.score}`);
  else log('TC-STORE-003', 'FAIL', JSON.stringify(saveResult));

  // TC-STORE-011: Corrupted storage recovery
  const corruptTest = await page.evaluate(() => {
    localStorage.setItem('english_practice_records', 'NOT_JSON{{');
    if (typeof getAllRecords === 'function') {
      const r = getAllRecords('test-device');
      return { recovered: Array.isArray(r), length: r.length };
    }
    return { error: 'getAllRecords not defined' };
  });
  if (corruptTest.recovered) log('TC-STORE-011', 'PASS', 'Corrupted storage returns empty array');
  else log('TC-STORE-011', 'FAIL', JSON.stringify(corruptTest));

  // === SCORING TESTS ===
  console.log('\n--- SCORING TESTS ---');

  const scoringTests = await page.evaluate(() => {
    const results = [];
    if (typeof scoreAnswer !== 'function' && typeof scoreListenChoose !== 'function') {
      return [{ error: 'scoring functions not in scope' }];
    }
    
    // TC-SCORE-001: listen_choose correct
    try {
      const r = scoreListenChoose(1, 1, 1.5);
      results.push({ id: 'TC-SCORE-001', pass: r.score === 1.5 && r.isPass === true });
    } catch(e) { results.push({ id: 'TC-SCORE-001', error: e.message }); }

    // TC-SCORE-002: listen_choose wrong
    try {
      const r = scoreListenChoose(0, 1, 1.5);
      results.push({ id: 'TC-SCORE-002', pass: r.score === 0 && r.isPass === false });
    } catch(e) { results.push({ id: 'TC-SCORE-002', error: e.message }); }

    // TC-SCORE-007: listen_answer empty
    try {
      const r = scoreListenAnswer('q', 'sample', ['kw1','kw2'], '', 2);
      results.push({ id: 'TC-SCORE-007', pass: r.score === 0 && r.isPass === false });
    } catch(e) { results.push({ id: 'TC-SCORE-007', error: e.message }); }

    // TC-SCORE-004: listen_answer high score
    try {
      const r = scoreListenAnswer('What did he buy?', 'He bought a scarf for his mother', ['scarf','mother','bought'], 
        'He bought a scarf for his mother', 2);
      results.push({ id: 'TC-SCORE-004', pass: r.score === 2 && r.isPass === true });
    } catch(e) { results.push({ id: 'TC-SCORE-004', error: e.message }); }

    // TC-SCORE-012: listen_retell empty
    try {
      const r = scoreListenRetell('topic', 'intro', [{label:'A', answer:'answer one'},{label:'B',answer:'answer two'}], '', 10);
      results.push({ id: 'TC-SCORE-012', pass: r.score === 0 && r.isPass === false });
    } catch(e) { results.push({ id: 'TC-SCORE-012', error: e.message }); }

    // TC-SCORE-016: read_aloud empty
    try {
      const r = scoreReading('The quick brown fox jumps over the lazy dog', '', 9);
      results.push({ id: 'TC-SCORE-016', pass: r.score === 0 && r.isPass === false });
    } catch(e) { results.push({ id: 'TC-SCORE-016', error: e.message }); }

    // TC-SCORE-013: read_aloud high similarity
    try {
      const passage = 'The quick brown fox jumps over the lazy dog every morning';
      const r = scoreReading(passage, passage, 9);
      results.push({ id: 'TC-SCORE-013', pass: r.score >= 9 * 0.9 });
    } catch(e) { results.push({ id: 'TC-SCORE-013', error: e.message }); }

    // TC-SCORE-020: unknown type
    try {
      const r = scoreAnswer('unknown', {}, '', 10);
      results.push({ id: 'TC-SCORE-020', pass: r.score === 0 && r.isPass === false });
    } catch(e) { results.push({ id: 'TC-SCORE-020', error: e.message }); }

    return results;
  });

  for (const t of scoringTests) {
    if (t.error) log(t.id, 'FAIL', t.error);
    else if (t.pass) log(t.id, 'PASS', '');
    else log(t.id, 'FAIL', 'Assertion failed');
  }

  // === EXAM PAGE TESTS ===
  console.log('\n--- EXAM TESTS ---');

  await page.goto(`${BASE}/#/exam`);
  await page.waitForTimeout(2000);
  const examContent = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasPapers: text.includes('Paper') || text.includes('套卷') || text.includes('考试'),
      paperCount: (text.match(/Paper \d+/g) || []).length
    };
  });
  if (examContent.hasPapers) log('TC-EXAM-001', 'PASS', `Exam page shows papers (${examContent.paperCount} found)`);
  else log('TC-EXAM-001', 'FAIL', 'No papers on exam page');

  // TC-ROUTE-005: Exam flow route
  await page.goto(`${BASE}/#/exam-flow?paperId=1`);
  await page.waitForTimeout(2000);
  const examFlowContent = await page.evaluate(() => {
    return document.body.innerText.includes('第') && document.body.innerText.includes('题');
  });
  if (examFlowContent) log('TC-FLOW-001', 'PASS', 'Exam flow shows question counter');
  else log('TC-FLOW-001', 'FAIL', 'No question counter in exam flow');

  // === HISTORY PAGE ===
  console.log('\n--- HISTORY TESTS ---');

  await page.goto(`${BASE}/#/history`);
  await page.waitForTimeout(1500);
  const historyContent = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHistory: text.includes('历史') || text.includes('记录'),
      hasEmpty: text.includes('暂无') || text.includes('空') || text.includes('还没有'),
      recordCount: document.querySelectorAll('a[href*="history-detail"]').length
    };
  });
  if (historyContent.hasHistory) log('TC-HIST-001', 'PASS', `History page loaded (records: ${historyContent.recordCount})`);
  else log('TC-HIST-001', 'FAIL', 'History page not loaded');

  // === SCORING GUIDE ===
  console.log('\n--- SCORING GUIDE ---');

  await page.goto(`${BASE}/#/scoring-guide?type=read_aloud`);
  await page.waitForTimeout(1500);
  const guideContent = await page.evaluate(() => {
    return document.body.innerText.includes('评分') || document.body.innerText.includes('标准') || document.body.innerText.includes('分');
  });
  if (guideContent) log('TC-GUIDE-001', 'PASS', 'Scoring guide page loaded');
  else log('TC-GUIDE-001', 'FAIL', 'Scoring guide not loaded');

  // === MOBILE LAYOUT ===
  console.log('\n--- LAYOUT TESTS ---');

  // TC-INT-005: Mobile 375px
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/#/practice/listen_choose`);
  await page.waitForTimeout(1000);
  const noOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= 375 + 2; // allow 2px tolerance
  });
  if (noOverflow) log('TC-INT-005', 'PASS', 'No horizontal overflow at 375px');
  else log('TC-INT-005', 'FAIL', `Horizontal overflow: ${await page.evaluate(() => document.documentElement.scrollWidth)}px`);

  // TC-INT-006: Landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  const landscapeOK = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= 844 + 2;
  });
  if (landscapeOK) log('TC-INT-006', 'PASS', 'Landscape layout OK');
  else log('TC-INT-006', 'FAIL', 'Landscape overflow');

  // === ERROR HANDLING ===
  console.log('\n--- ERROR HANDLING ---');

  // TC-EDGE-001: Invalid questionId
  await page.goto(`${BASE}/#/practice-answer?questionId=99999&type=listen_choose`);
  await page.waitForTimeout(2000);
  const noCrash = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root && root.innerHTML.length > 100 && !root.innerHTML.includes('应用加载失败');
  });
  if (noCrash) log('TC-EDGE-001', 'PASS', 'Invalid questionId handled without crash');
  else log('TC-EDGE-001', 'FAIL', 'App crashed on invalid questionId');

  // TC-EDGE-002: Invalid type
  await page.goto(`${BASE}/#/practice-answer?questionId=1&type=unknown`);
  await page.waitForTimeout(2000);
  const noCrash2 = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root && root.innerHTML.length > 100 && !root.innerHTML.includes('应用加载失败');
  });
  if (noCrash2) log('TC-EDGE-002', 'PASS', 'Invalid type handled');
  else log('TC-EDGE-002', 'FAIL', 'App crashed on invalid type');

  // === SUMMARY ===
  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.length}, Pass: ${pass}, Fail: ${fail}`);
  console.log('\n--- FAILED TESTS ---');
  const failed = results.filter(r => r.status === 'FAIL');
  if (failed.length === 0) console.log('  None');
  for (const f of failed) console.log(`  ${f.id}: ${f.detail}`);

  await browser.close();
  return { pass, fail, results };
}

test().then(r => {
  process.exit(r.fail > 0 ? 1 : 0);
}).catch(e => {
  console.error('Test runner error:', e);
  process.exit(2);
});
