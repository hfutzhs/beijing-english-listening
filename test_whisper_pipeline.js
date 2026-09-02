const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/test_speech.wav',
      '--auto-accept-camera-and-microphone-capture',
    ],
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('[Whisper]')) console.log('  [BROWSER]', text);
  });
  page.on('pageerror', err => console.log('  [PAGE ERROR]', err.message));

  console.log('1. Navigating to read_aloud practice page...');
  await page.goto('http://127.0.0.1:8101/index.html#/practice/read_aloud');
  await page.waitForTimeout(3000);

  const btnTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText.trim(),
      w: b.offsetWidth,
      h: b.offsetHeight,
      round: b.style.borderRadius
    }));
  });
  console.log('2. Buttons:', JSON.stringify(btnTexts.slice(0, 8)));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const recordBtn = btns.find(b => b.innerText.includes('录音') || b.innerText.includes('开始') || (b.offsetWidth > 50 && b.offsetHeight > 50));
    if (recordBtn) { recordBtn.click(); return true; }
    if (btns.length > 0) { btns[0].click(); return true; }
    return false;
  });
  console.log('3. Clicked record button');

  console.log('4. Recording for 8 seconds...');
  await page.waitForTimeout(8000);

  console.log('5. Stopping recording...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const stopBtn = btns.find(b => b.innerText.includes('停止') || b.innerText.includes('完成') || (b.offsetWidth > 50 && b.offsetHeight > 50));
    if (stopBtn) { stopBtn.click(); return true; }
    if (btns.length > 0) { btns[0].click(); return true; }
    return false;
  });

  console.log('6. Waiting for transcription (up to 5 minutes)...');
  let transcript = '';
  let error = '';
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(5000);
    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      const hasTranscribing = body.includes('识别中') || body.includes('加载语音模型');
      const hasError = body.includes('语音识别失败');
      const textareas = document.querySelectorAll('textarea');
      const textareaContent = textareas.length > 0 ? textareas[0].value : '';
      return { hasTranscribing, hasError, textareaContent };
    });
    console.log(`   ${i*5}s: transcribing=${state.hasTranscribing}, error=${state.hasError}, textarea="${state.textareaContent.substring(0, 80)}"`);
    
    if (state.textareaContent && state.textareaContent.trim().length > 3) {
      transcript = state.textareaContent;
      console.log('7. TRANSCRIPTION FOUND:', transcript);
      break;
    }
    if (state.hasError && !state.hasTranscribing) {
      error = 'error';
      console.log('7. ERROR DETECTED');
      break;
    }
  }

  const whisperLogs = consoleLogs.filter(l => l.includes('[Whisper]'));
  console.log('\n8. Whisper console logs:');
  whisperLogs.forEach(l => console.log('  ', l));

  if (transcript && transcript.trim().length > 3) {
    console.log('\n=== SUCCESS: Speech recognition working! ===');
    console.log('   Transcript:', transcript.substring(0, 200));
  } else if (error) {
    console.log('\n=== FAILED: Error detected ===');
  } else {
    console.log('\n=== TIMEOUT: No transcript after 5 min ===');
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
