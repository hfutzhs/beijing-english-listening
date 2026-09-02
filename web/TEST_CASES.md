# 北京市中考英语听说练习网站 - 测试用例矩阵

## 测试范围

| 模块 | 文件 | 功能概述 |
|------|------|----------|
| 题目数据生成 | `src/data/questions.ts` | 21套卷 × 14题 = 294题，4种题型 |
| 评分引擎 | `src/lib/scoring.ts` | listen_choose/answer/retell/read_aloud 四套算法 |
| TTS 语音合成 | `src/lib/tts.ts` + `index.html` TTSPlayer | 预生成 MP3 + speechSynthesis 回退 |
| ASR 语音识别 | `src/lib/asr.ts` | 浏览器 SpeechRecognition API |
| 本地存储 | `src/lib/storage.ts` + `device.ts` | localStorage 练习记录/设备ID |
| 路由 | `index.html` hash router | 8条路由，全屏/带TabBar |
| 页面 | PracticeList/Answer/ExamMock/ExamFlow/History/HistoryDetail/ScoringGuide | 练习/考试/历史/评分标准 |

## 题型分值结构

| 题型 | 每套题数 | 每题分值 | 套卷小计 | ID范围 |
|------|---------|---------|---------|--------|
| listen_choose 听后选择 | 6 | 1.5 | 9 | 1-126 |
| listen_answer 听后回答 | 6 | 2 | 12 | 127-252 |
| listen_retell 听后转述 | 1 | 10 | 10 | 253-273 |
| read_aloud 短文朗读 | 1 | 9 | 9 | 274-294 |
| **合计** | **14** | - | **40** | **294题** |

---

## 模块一：题目数据生成 (questions.ts)

### TC-DATA-001 题目总数验证
- **前置条件**：应用加载完成
- **步骤**：调用 `fetchQuestions({})` 获取全部题目
- **预期**：返回 294 道题，`questions.length === 294`

### TC-DATA-002 按类型查询
- **步骤**：分别调用 `fetchQuestions({type: 'listen_choose'})` / `listen_answer` / `listen_retell` / `read_aloud`
- **预期**：各返回 126 / 126 / 21 / 21 题

### TC-DATA-003 按套卷查询
- **步骤**：调用 `fetchQuestions({paperId: 1})`
- **预期**：返回 14 题（6 LC + 6 LA + 1 LR + 1 RA），每题 `paper_id === 1`

### TC-DATA-004 ID 唯一性
- **步骤**：遍历 `questions` 检查 id 是否 1-294 连续且无重复
- **预期**：id 集合大小 294，最小值 1，最大值 294

### TC-DATA-005 题型 ID 分段
- **步骤**：检查 id 1-126 为 listen_choose，127-252 为 listen_answer，253-273 为 listen_retell，274-294 为 read_aloud
- **预期**：每段 type 与预期一致

### TC-DATA-006 分值正确性
- **步骤**：检查各题型 `max_score` 字段
- **预期**：LC=1.5, LA=2, LR=10, RA=9

### TC-DATA-007 难度系数递增
- **步骤**：检查同题型不同 paper 的 `difficulty_coefficient` 是否随 paper 递增
- **预期**：paper 1 的系数最低，paper 21 最高

### TC-DATA-008 套卷总数
- **步骤**：调用 `fetchPapers()` 获取试卷列表
- **预期**：返回 21 套卷，每套 `questionCount === 14`，`totalScore === 40`

### TC-DATA-009 题目内容完整性
- **步骤**：遍历各类型题目的 content 字段
- **预期**：
  - LC: `content.question` 非空，`content.options` 长度 4，`content.correct_answer` 在 0-3 范围内
  - LA: `content.question` / `sample_answer` / `keywords` 非空
  - LR: `content.topic` / `intro` / `info_points` 非空，info_points 至少 3 个
  - RA: `content.passage` 非空，长度 > 50 字符

### TC-DATA-010 audio_script 非空
- **步骤**：遍历全部 294 题，检查 `audio_script` 字段
- **预期**：每题 `audio_script` 均为非空字符串

### TC-DATA-011 获取不存在题目
- **步骤**：调用 `fetchQuestionDetail(999)`
- **预期**：Promise reject，错误信息 '题目不存在'

---

## 模块二：评分引擎 (scoring.ts)

### TC-SCORE-001 listen_choose 答对
- **步骤**：`scoreListenChoose(1, 1, 1.5)`（选中正确答案）
- **预期**：`score === 1.5`，`isPass === true`，`feedback.isCorrect === true`

### TC-SCORE-002 listen_choose 答错
- **步骤**：`scoreListenChoose(0, 1, 1.5)`（选中错误答案）
- **预期**：`score === 0`，`isPass === false`，`feedback.isCorrect === false`

### TC-SCORE-003 listen_choose 边界答案索引
- **步骤**：`scoreListenChoose(-1, 0, 1.5)`（无效索引）和 `scoreListenChoose(3, 3, 1.5)`（最后一个选项）
- **预期**：-1 不匹配返回 0 分；3 匹配返回满分

### TC-SCORE-004 listen_answer 高分回答
- **步骤**：transcript 包含全部 keywords 且与 sample_answer 相似度 > 0.7
- **预期**：`score === maxScore`，`isPass === true`

### TC-SCORE-005 listen_answer 部分关键词
- **步骤**：transcript 包含 50% keywords，相似度 0.4-0.5
- **预期**：`score === maxScore * 0.7`（四舍五入到小数点后1位），`isPass === true`

### TC-SCORE-006 listen_answer 低分回答
- **步骤**：transcript 仅包含 1 个关键词，相似度 < 0.2
- **预期**：`score === 0`，`isPass === false`

### TC-SCORE-007 listen_answer 空回答
- **步骤**：transcript 为空字符串
- **预期**：`score === 0`，`isPass === false`，`feedback.analysis` 包含 '未作答'

### TC-SCORE-008 listen_answer 大小写无关
- **步骤**：transcript 全大写 vs 全小写，内容相同
- **预期**：两者得分相同（normalize 转小写）

### TC-SCORE-009 listen_retell 高覆盖率
- **步骤**：transcript 覆盖 >= 90% 信息点，语言相似度 >= 0.5
- **预期**：`score >= maxScore * 0.9`，`scoreLevel === '9-10分档'`

### TC-SCORE-010 listen_retell 中等覆盖率
- **步骤**：transcript 覆盖 50-70% 信息点
- **预期**：`scoreLevel === '5-6分档'` 或 `'7-8分档'`，`isPass` 视具体分值而定

### TC-SCORE-011 listen_retell 低覆盖率
- **步骤**：transcript 覆盖 < 30% 信息点
- **预期**：`scoreLevel === '0-2分档'`，`isPass === false`

### TC-SCORE-012 listen_retell 空回答
- **步骤**：transcript 为空
- **预期**：`score === 0`，`feedback.missingPoints` 包含全部信息点

### TC-SCORE-013 read_aloud 高相似度
- **步骤**：transcript 与 passage 几乎一致，overallSim >= 0.9
- **预期**：`score >= maxScore * 0.95`，`scoreLevel === '9分档'`

### TC-SCORE-014 read_aloud 中等相似度
- **步骤**：transcript 漏读部分单词，overallSim 0.55-0.75
- **预期**：`scoreLevel === '5-6分档'` 或 `'7-8分档'`

### TC-SCORE-015 read_aloud 低相似度
- **步骤**：transcript 与 passage 差异大，overallSim < 0.3
- **预期**：`scoreLevel === '0-2分档'`，`isPass === false`

### TC-SCORE-016 read_aloud 空回答
- **步骤**：transcript 为空
- **预期**：`score === 0`，`feedback.specificIssues === '未检测到朗读内容'`

### TC-SCORE-017 read_aloud 漏读统计
- **步骤**：transcript 缺少 passage 中若干单词
- **预期**：`feedback.specificIssues` 包含 '漏读' 字样和漏读词数

### TC-SCORE-018 read_aloud 多读统计
- **步骤**：transcript 包含 passage 中没有的额外单词
- **预期**：`feedback.specificIssues` 包含 '多读' 字样和多余词数

### TC-SCORE-019 scoreAnswer 分发器
- **步骤**：分别用 4 种 type 调用 `scoreAnswer`
- **预期**：每种 type 调用对应评分函数，返回结构正确

### TC-SCORE-020 scoreAnswer 未知类型
- **步骤**：`scoreAnswer('unknown', {}, '', 10)`
- **预期**：返回 `score === 0`，`isPass === false`（default 分支）

---

## 模块三：TTS 语音合成 (tts.ts / TTSPlayer)

### TC-TTS-001 预生成音频播放
- **前置条件**：`/audio/{qid}.mp3` 文件存在
- **步骤**：打开练习页，点击播放按钮
- **预期**：播放 MP3 文件，非 speechSynthesis；播放完毕按钮恢复

### TC-TTS-002 音频回退到 speechSynthesis
- **前置条件**：`/audio/{qid}.mp3` 不存在（如 ID > 已生成范围）
- **步骤**：点击播放按钮
- **预期**：自动回退到 `speechSynthesis`，以 0.85 语速播放

### TC-TTS-003 音频文件损坏回退
- **步骤**：播放一个损坏/0字节 MP3 文件
- **预期**：`audio.onerror` 触发，自动回退到 speechSynthesis

### TC-TTS-004 停止播放
- **步骤**：播放中再次点击按钮
- **预期**：音频停止，按钮恢复为播放态，word highlight 清除（onWordIndex(-1)）

### TC-TTS-005 listen_retell 两遍播放
- **前置条件**：题型为 listen_retell，`playCount === 2`
- **步骤**：点击播放，等待第一遍结束
- **预期**：800ms 间隔后自动播放第二遍，显示 '第 2 / 2 遍'；两遍结束后按钮恢复

### TC-TTS-006 listen_choose 单遍播放
- **步骤**：播放 listen_choose 题型音频
- **预期**：`playCount === 1`，播放一次后按钮恢复

### TC-TTS-007 read_aloud 逐词高亮
- **前置条件**：read_aloud 题型，有 `words` 和 `onWordIndex` props
- **步骤**：播放标准朗读
- **预期**：播放过程中 `currentWordIndex` 随进度更新，对应单词高亮

### TC-TTS-008 不支持 speechSynthesis
- **步骤**：在不支持 speechSynthesis 的浏览器中打开
- **预期**：显示 '当前浏览器不支持语音合成' 警示

### TC-TTS-009 checkAudioExists 缓存
- **步骤**：对同一 qid 调用 `checkAudioExists` 两次
- **预期**：第二次直接从 `audioExistsCache` 返回，不发起 HTTP HEAD 请求

### TC-TTS-010 组件卸载清理
- **步骤**：播放音频时导航离开页面
- **预期**：`useEffect` cleanup 停止 speech 和 audio，无残留播放

---

## 模块四：ASR 语音识别 (asr.ts / RecordButton)

### TC-ASR-001 开始录音
- **前置条件**：已授权麦克风，浏览器支持 SpeechRecognition
- **步骤**：点击"开始录音"按钮
- **预期**：按钮变红，显示计时器，实时识别 interim text

### TC-ASR-002 停止录音并获取转写
- **步骤**：录音中点击"停止录音"
- **预期**：计时器停止，返回 `{ audioUrl, transcript }`，transcript 为最终识别文本

### TC-ASR-003 重新录音
- **步骤**：录音完成后再点击录音按钮
- **预期**：清除上次录音，重新开始录音

### TC-ASR-004 麦克风未授权
- **步骤**：拒绝麦克风权限后点击录音
- **预期**：`error` 显示 '无法访问麦克风，请检查权限设置'

### TC-ASR-005 不支持 SpeechRecognition
- **步骤**：在 Firefox/Safari 中打开（不支持 webkitSpeechRecognition）
- **预期**：`isASRSupported() === false`，录音仍可用但 transcript 为空

### TC-ASR-006 识别错误处理
- **步骤**：录音过程中断网或权限被撤销
- **预期**：`recognition.onerror` 触发，返回 `{ transcript, error }`

### TC-ASR-007 播放录音回放
- **步骤**：录音完成后点击"播放录音"
- **预期**：播放录制的音频，按钮切换为暂停状态

### TC-ASR-008 识别中状态
- **步骤**：停止录音后 ASR 仍在处理
- **预期**：按钮显示 '语音识别中...'，禁用操作

---

## 模块五：本地存储 (storage.ts / device.ts)

### TC-STORE-001 设备ID生成
- **步骤**：首次访问应用，调用 `getDeviceId()`
- **预期**：生成 UUID 存入 localStorage，后续调用返回同一 ID

### TC-STORE-002 设备ID 持久化
- **步骤**：刷新页面后再次调用 `getDeviceId()`
- **预期**：返回同一 UUID（从 localStorage 读取）

### TC-STORE-003 保存练习记录
- **步骤**：提交一次练习答案
- **预期**：`saveRecord` 生成 `id`（时间戳）和 `created_at`（ISO），记录存入 localStorage

### TC-STORE-004 按设备过滤记录
- **步骤**：调用 `getAllRecords(deviceId)`
- **预期**：仅返回该设备的记录

### TC-STORE-005 按类型查询已答题目
- **步骤**：`getAnsweredQuestionIds(deviceId, 'listen_choose')`
- **预期**：返回去重后的 question_id 数组

### TC-STORE-006 清除历史
- **步骤**：`clearAllRecords(deviceId)` 后查询
- **预期**：该设备记录被清除，其他设备记录不受影响

### TC-STORE-007 考试进度查询
- **步骤**：完成一套考试后调用 `getExamProgress(deviceId)`
- **预期**：返回已完成考试的 paper_id 数组

### TC-STORE-008 统计数据
- **步骤**：有多条练习记录后调用 `getStats(deviceId)`
- **预期**：返回 `total` / `passed` / `failed` / `avg_score` / `byType`，数值正确

### TC-STORE-009 考试总分查询
- **步骤**：完成考试后 `getExamScoreForPaper(deviceId, 1)`
- **预期**：返回该套卷所有考试题目的分数之和

### TC-STORE-010 未完成考试查询
- **步骤**：`getExamScoreForPaper(deviceId, 99)`（未做的套卷）
- **预期**：返回 `null`

### TC-STORE-011 存储损坏恢复
- **步骤**：手动写入非法 JSON 到 localStorage 的 `english_practice_records`
- **预期**：`getAllRecords` 返回空数组而非抛出异常（try-catch）

---

## 模块六：路由

### TC-ROUTE-001 默认路由
- **步骤**：打开 `http://127.0.0.1:5174/`（无 hash）
- **预期**：渲染 PracticeList(type='listen_choose')，底部显示 TabBar

### TC-ROUTE-002 练习列表路由
- **步骤**：依次导航到 `#/practice/listen_choose` / `listen_answer` / `listen_retell` / `read_aloud`
- **预期**：分别渲染对应题型的列表页

### TC-ROUTE-003 练习答题路由
- **步骤**：导航到 `#/practice-answer?questionId=1&type=listen_choose`
- **预期**：渲染 PracticeAnswer，传入 questionId=1, qType='listen_choose'，隐藏 TabBar

### TC-ROUTE-004 考试列表路由
- **步骤**：导航到 `#/exam`
- **预期**：渲染 ExamMock 页面

### TC-ROUTE-005 考试流程路由
- **步骤**：导航到 `#/exam-flow?paperId=1`
- **预期**：渲染 ExamFlow，传入 paperId=1，隐藏 TabBar

### TC-ROUTE-006 历史记录路由
- **步骤**：导航到 `#/history`
- **预期**：渲染 History 页面

### TC-ROUTE-007 历史详情路由
- **步骤**：导航到 `#/history-detail?id=123`
- **预期**：渲染 HistoryDetail，传入 recordId=123，隐藏 TabBar

### TC-ROUTE-008 评分标准路由
- **步骤**：导航到 `#/scoring-guide?type=read_aloud`
- **预期**：渲染 ScoringGuide，传入 type='read_aloud'，隐藏 TabBar

### TC-ROUTE-009 未知路由
- **步骤**：导航到 `#/unknown`
- **预期**：fallback 到 PracticeList(type='listen_choose')

### TC-ROUTE-010 TabBar 显示/隐藏
- **步骤**：在 PracticeList 页和 PracticeAnswer 页分别检查 TabBar
- **预期**：PracticeList 显示 TabBar；PracticeAnswer/ExamFlow/ScoringGuide/HistoryDetail 隐藏 TabBar

---

## 模块七：PracticeList 练习列表页

### TC-LIST-001 题目卡片展示
- **步骤**：打开练习列表页
- **预期**：显示该类型所有题目卡片，每张卡片显示题号、题型标签、分值

### TC-LIST-002 已答标记
- **前置条件**：有该类型已答记录
- **步骤**：查看列表
- **预期**：已答题目卡片有视觉标记（如对勾或颜色区分）

### TC-LIST-003 导航到答题页
- **步骤**：点击任一题目卡片
- **预期**：跳转到 `#/practice-answer?questionId={id}&type={type}`

### TC-LIST-004 分页/滚动
- **步骤**：题目数量 > 屏幕可视区域
- **预期**：可滚动浏览全部题目，底部 TabBar 不遮挡内容（paddingBottom: 56px）

### TC-LIST-005 试卷切换
- **步骤**：切换不同套卷（如有的话）
- **预期**：列表更新为对应套卷题目

---

## 模块八：PracticeAnswer 练习答题页

### TC-ANS-001 听后选择流程
- **步骤**：打开 listen_choose 题 -> 播放音频 -> 选择选项 -> 提交
- **预期**：提交后显示对错、正确答案、解析

### TC-ANS-002 听后选择正确选项高亮
- **步骤**：提交答案后查看选项
- **预期**：正确选项绿色高亮，错误选中项红色标记

### TC-ANS-003 听后回答流程
- **步骤**：打开 listen_answer 题 -> 播放音频 -> 录音回答 -> 提交
- **预期**：显示转写文本、关键词匹配情况、得分

### TC-ANS-004 听后转述两遍播放
- **步骤**：打开 listen_retell 题 -> 播放音频
- **预期**：播放按钮标签为'播放听力原文（两遍）'，播放两轮

### TC-ANS-005 短文朗读流程
- **步骤**：打开 read_aloud 题 -> 播放标准朗读 -> 录音朗读 -> 提交
- **预期**：显示准确度/流利度/完整性分析、得分等级

### TC-ANS-006 题目切换导航
- **步骤**：答题页顶部使用题目切换按钮
- **预期**：在同级题目间导航，URL 更新 questionId

### TC-ANS-007 评分标准入口
- **步骤**：点击"评分标准"按钮
- **预期**：跳转到 `#/scoring-guide?type={qType}`

### TC-ANS-008 返回练习列表
- **步骤**：点击返回箭头
- **预期**：返回 `#/practice/{qType}` 或浏览器上一页

### TC-ANS-009 未答提交拦截
- **步骤**：不录音/不选择直接提交
- **预期**：得 0 分或提示需先作答

### TC-ANS-010 答案查看但不提交
- **步骤**：选择选项但不提交
- **预期**：不显示对错结果，可随时修改选择

---

## 模块九：ExamMock 考试列表页

### TC-EXAM-001 套卷列表展示
- **步骤**：打开 `#/exam`
- **预期**：显示 21 套卷，每套显示标题、题型组成、总分 40 分

### TC-EXAM-002 已完成套卷标记
- **前置条件**：有已完成考试的套卷
- **步骤**：查看列表
- **预期**：已完成的套卷显示分数或完成标记

### TC-EXAM-003 开始考试
- **步骤**：点击"开始考试"
- **预期**：跳转到 `#/exam-flow?paperId={id}`

### TC-EXAM-004 考试总分显示
- **前置条件**：已完成某套卷
- **步骤**：查看该套卷
- **预期**：显示该套卷考试总分（所有题目分数之和）

---

## 模块十：ExamFlow 考试流程页

### TC-FLOW-001 题目顺序
- **步骤**：进入考试流程
- **预期**：按 LC(6) -> LA(6) -> LR(1) -> RA(1) 顺序出题

### TC-FLOW-002 题目导航
- **步骤**：答题过程中使用题号切换
- **预期**：可跳转任意题目，当前题高亮

### TC-FLOW-003 答题进度
- **步骤**：查看进度指示
- **预期**：显示 '第 X / 14 题'，各题型 section 标签可见

### TC-FLOW-004 考试提交
- **步骤**：完成全部 14 题后提交
- **预期**：跳转到结果页，显示总分、各题型得分

### TC-FLOW-005 未完成提交
- **步骤**：部分题目未答时提交
- **预期**：提示未完成题目或允许提交但缺失题得 0 分

### TC-FLOW-006 考试记录存储
- **步骤**：考试提交后检查 localStorage
- **预期**：14 条记录 `session_id === 'exam'`，`paper_id` 一致

### TC-FLOW-007 退出考试
- **步骤**：考试中点击退出
- **预期**：返回考试列表或提示确认退出

---

## 模块十一：History 历史记录页

### TC-HIST-001 空历史
- **前置条件**：无练习记录
- **步骤**：打开历史页
- **预期**：显示空状态提示

### TC-HIST-002 记录列表展示
- **前置条件**：有多条练习记录
- **步骤**：打开历史页
- **预期**：按时间倒序排列，每条显示题型、得分、日期

### TC-HIST-003 按题型筛选
- **步骤**：切换题型筛选器
- **预期**：列表仅显示对应题型记录

### TC-HIST-004 按模式筛选
- **步骤**：切换练习/考试模式筛选
- **预期**：列表仅显示对应 session_id 的记录

### TC-HIST-005 错题筛选
- **步骤**：勾选"仅看错题"
- **预期**：列表仅显示 `is_failed === true` 的记录

### TC-HIST-006 清除历史
- **步骤**：点击"清除历史"
- **预期**：确认后清除该设备全部记录

### TC-HIST-007 导航到详情
- **步骤**：点击某条记录
- **预期**：跳转到 `#/history-detail?id={recordId}`

### TC-HIST-008 重新练习
- **步骤**：在详情页点击"重新练习"
- **预期**：跳转到 `#/practice-answer?questionId={qid}&type={type}`

---

## 模块十二：HistoryDetail 历史详情页

### TC-DETAIL-001 评分展示
- **步骤**：打开历史详情
- **预期**：显示分数、得分等级、各维度分析

### TC-DETAIL-002 题型差异展示
- **步骤**：分别打开 4 种题型的历史详情
- **预期**：
  - LC: 显示对错、选项
  - LA: 显示转写、关键词匹配、参考答案
  - LR: 显示信息点覆盖、缺失点
  - RA: 显示准确度/流利度/完整性分析

### TC-DETAIL-003 重新练习入口
- **步骤**：点击"重新练习"
- **预期**：跳转到对应练习答题页

---

## 模块十三：ScoringGuide 评分标准页

### TC-GUIDE-001 各题型评分标准
- **步骤**：分别导航 `#/scoring-guide?type=listen_choose` / `listen_answer` / `listen_retell` / `read_aloud`
- **预期**：显示对应题型的评分标准、分值分布

### TC-GUIDE-002 返回
- **步骤**：点击返回箭头
- **预期**：返回上一页

---

## 模块十四：跨模块/集成

### TC-INT-001 练习 -> 历史 -> 重做
- **步骤**：完成一道练习 -> 查看历史 -> 从历史跳转回练习
- **预期**：全链路导航正常，新记录出现在历史中

### TC-INT-002 考试 -> 历史
- **步骤**：完成一套考试 -> 查看历史
- **预期**：14 条考试记录出现，按 session_id='exam' 可筛选

### TC-INT-003 多设备隔离
- **步骤**：清除 localStorage 中的 device_id，重新生成
- **预期**：新设备看不到旧记录，各自隔离

### TC-INT-004 刷新保持状态
- **步骤**：答题过程中刷新页面
- **预期**：回到答题列表页（hash 路由不保存答题中间态）

### TC-INT-005 移动端适配
- **步骤**：在 375px 宽度模拟器中查看各页面
- **预期**：布局正常，触摸目标 >= 44px，文字不溢出

### TC-INT-006 横屏适配
- **步骤**：在 768x400 横屏模拟器中查看
- **预期**：横屏布局生效，卡片列数调整为 3 列

### TC-INT-007 音频文件缺失不影响使用
- **前置条件**：部分题目无预生成 MP3
- **步骤**：播放缺失音频的题目
- **预期**：自动回退 speechSynthesis，用户无感知中断

---

## 模块十五：边界/异常

### TC-EDGE-001 无效 questionId
- **步骤**：导航 `#/practice-answer?questionId=99999&type=listen_choose`
- **预期**：显示错误提示或回退

### TC-EDGE-002 无效 type 参数
- **步骤**：导航 `#/practice-answer?questionId=1&type=unknown`
- **预期**：降级处理，不崩溃

### TC-EDGE-003 超长文本朗读
- **步骤**：朗读一个 > 500 字的 passage
- **预期**：TTS 正常播放，评分逻辑不超时

### TC-EDGE-004 快速连续操作
- **步骤**：快速多次点击播放/停止按钮
- **预期**：无音频重叠，最终状态与最后一次操作一致

### TC-EDGE-005 localStorage 容量
- **步骤**：积累大量练习记录（> 500 条）后查看历史
- **预期**：页面正常加载，无性能明显下降

### TC-EDGE-006 网络断开
- **步骤**：断网状态下打开应用
- **预期**：题目数据和 localStorage 正常，仅 Edge TTS 生成不可用（不影响已生成音频播放）

---

## 测试优先级矩阵

| 优先级 | 测试范围 | 说明 |
|--------|---------|------|
| P0 | TC-SCORE-001~020 | 评分正确性是核心功能 |
| P0 | TC-TTS-001~005 | 音频播放是所有题型的基础 |
| P0 | TC-ANS-001~005 | 四种题型答题流程 |
| P0 | TC-FLOW-001~006 | 考试流程完整性 |
| P1 | TC-DATA-001~011 | 数据完整性保证 |
| P1 | TC-ASR-001~004 | 录音核心流程 |
| P1 | TC-STORE-001~009 | 存储可靠性 |
| P1 | TC-ROUTE-001~010 | 路由正确性 |
| P2 | TC-ASR-005~008 | ASR 边界场景 |
| P2 | TC-HIST-001~008 | 历史功能 |
| P2 | TC-INT-001~007 | 集成测试 |
| P3 | TC-EDGE-001~006 | 异常场景 |
| P3 | TC-GUIDE-001~002 | 辅助页面 |
