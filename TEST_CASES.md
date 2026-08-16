# 北京市中考英语听说练习 — 测试用例矩阵

## 测试环境
- 浏览器: Chromium (headless) 模拟 iPhone 14 (390x844)
- 服务器: Vite dev server http://localhost:5176
- 框架: Playwright 1.62.1
- 测试脚本: /tmp/test_full_mobile.mjs

## 测试结果汇总

| 模块 | 用例数 | 通过 | 失败 |
|------|--------|------|------|
| TabBar Navigation | 7 | 7 | 0 |
| PracticeList | 5 | 5 | 0 |
| PracticeAnswer (listen_choose) | 16 | 16 | 0 |
| PracticeAnswer (listen_answer) | 6 | 6 | 0 |
| PracticeAnswer (listen_retell) | 4 | 4 | 0 |
| PracticeAnswer (read_aloud) | 6 | 6 | 0 |
| ExamMock | 3 | 3 | 0 |
| ExamFlow | 9 | 9 | 0 |
| Full Exam Submission | 8 | 8 | 0 |
| History | 7 | 7 | 0 |
| HistoryDetail | 3 | 3 | 0 |
| ScoringGuide | 3 | 3 | 0 |
| History Clear | 4 | 4 | 0 |
| History Persistence | 4 | 4 | 0 |
| Responsive Layout | 3 | 3 | 0 |
| **合计** | **88** | **88** | **0** |

## 测试用例详情

### SECTION 1: TabBar Navigation
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T1.1 | 首页加载(听后选择) | 显示"听后选择"标题 | PASS |
| T1.2 | TabBar-听后回答 | 切换到听后回答页 | PASS |
| T1.3 | TabBar-听后转述 | 切换到听后转述页 | PASS |
| T1.4 | TabBar-短文朗读 | 切换到短文朗读页 | PASS |
| T1.5 | TabBar-考试模拟 | 切换到考试模拟页 | PASS |
| T1.6 | TabBar-历史 | 切换到历史记录页 | PASS |
| T1.7 | TabBar-听后选择 | 切换回听后选择页 | PASS |

### SECTION 2: PracticeList
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T2.1 | 试卷选择器可见 | 试卷1按钮存在 | PASS |
| T2.2 | 切换试卷2 | 点击后高亮 | PASS |
| T2.3 | 切换回试卷1 | 点击后高亮 | PASS |
| T2.4 | 题目卡片数量 | >0张卡片 | PASS (count=6) |
| T2.5 | 点击题目跳转答题页 | URL含/practice-answer | PASS |

### SECTION 3: PracticeAnswer (listen_choose)
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T3.1 | 返回按钮可见 | 按钮存在 | PASS |
| T3.2 | 评分标准按钮 | 跳转到评分标准页 | PASS |
| T3.3 | 题目导航药丸 | >0个导航 | PASS (count=6) |
| T3.4 | 切换题目(药丸) | URL含questionId=2 | PASS |
| T3.5 | 播放按钮可见 | 按钮存在 | PASS |
| T3.6 | 播放后停止按钮 | 播放后出现停止 | PASS |
| T3.7 | 选项按钮 | >=2个选项 | PASS (count=5) |
| T3.8 | 选择选项A | 点击成功 | PASS |
| T3.9 | 提交按钮可点击 | enabled状态 | PASS |
| T3.10 | 结果显示 | 显示答题结果 | PASS |
| T3.11 | 重新作答按钮 | 按钮可见 | PASS |
| T3.12 | 重新作答重置 | 结果消失 | PASS |
| T3.13 | 下一题按钮 | 按钮可见 | PASS |
| T3.14 | 下一题跳转 | URL含questionId | PASS |
| T3.15 | 上一题按钮 | 按钮可见 | PASS |
| T3.16 | 上一题跳转 | URL含questionId | PASS |

### SECTION 4: PracticeAnswer (listen_answer)
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T4.1 | 页面加载 | 显示"听后回答" | PASS |
| T4.2 | 播放按钮 | 按钮可见 | PASS |
| T4.3 | 录音按钮 | 按钮可见 | PASS |
| T4.4 | 文本框 | textarea可见 | PASS |
| T4.5 | 文本输入 | 输入成功 | PASS |
| T4.6 | 提交 | 结果显示 | PASS |

### SECTION 5: PracticeAnswer (listen_retell)
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T5.1 | 页面加载 | 显示"听后转述" | PASS |
| T5.2 | 播放按钮 | 按钮可见 | PASS |
| T5.3 | 文本框 | textarea可见 | PASS |
| T5.4 | 提交 | 结果显示 | PASS |

### SECTION 6: PracticeAnswer (read_aloud)
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T6.1 | 页面加载 | 显示"短文朗读" | PASS |
| T6.2 | 文章显示 | 朗读文本可见 | PASS |
| T6.3 | 录音按钮 | 按钮可见 | PASS |
| T6.4 | 文本框 | textarea可见 | PASS |
| T6.5 | 提交 | 结果显示 | PASS |
| T6.6 | 评分分析 | 评分分析内容可见 | PASS |

### SECTION 7: ExamMock
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T7.1 | 试卷列表 | 试卷1按钮可见 | PASS |
| T7.2 | 试卷数量 | >0套试卷 | PASS (count=21) |
| T7.3 | 进入考试流程 | URL含/exam-flow | PASS |

### SECTION 8: ExamFlow
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T8.1 | 考试题导航药丸 | >0个 | PASS (count=14) |
| T8.2 | 播放按钮 | 按钮可见 | PASS |
| T8.3 | 选项按钮 | >=2个 | PASS (count=4) |
| T8.4 | 选择选项A | 点击成功 | PASS |
| T8.5 | 下一题按钮 | 按钮可见 | PASS |
| T8.6 | 下一题跳转 | 切换成功 | PASS |
| T8.7 | 上一题按钮 | 按钮可见 | PASS |
| T8.8 | 退出确认对话框 | 显示"确认退出" | PASS |
| T8.9 | 继续考试 | 点击后关闭对话框 | PASS |

### SECTION 9: Full Exam Submission
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T9.1 | 交卷按钮可见 | 按钮存在 | PASS |
| T9.2 | 交卷可点击 | enabled状态 | PASS |
| T9.3 | 考试结果页 | 显示总分/结果 | PASS |
| T9.4 | 总分显示 | 显示分数/40 | PASS |
| T9.5 | 重新考试按钮 | 按钮可见 | PASS |
| T9.6 | 重新考试跳转 | URL含/exam-flow | PASS |
| T9.7 | 返回列表按钮 | 按钮可见 | PASS |
| T9.8 | 返回列表跳转 | URL含/exam | PASS |

### SECTION 10: History
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T10.1 | 统计信息 | 显示总练习/及格/平均分 | PASS |
| T10.2 | 筛选按钮 | >0个筛选 | PASS (count=5) |
| T10.3 | 筛选切换 | 切换成功 | PASS |
| T10.4 | 只看错题按钮 | 按钮可见 | PASS |
| T10.5 | 只看错题切换 | 切换成功 | PASS |
| T10.6 | 历史记录项 | >0条记录 | PASS (count=58) |
| T10.7 | 历史详情跳转 | URL含/history-detail | PASS |

### SECTION 11: HistoryDetail
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T11.1 | 返回按钮 | 按钮可见 | PASS |
| T11.2 | 重新练习按钮 | 按钮可见 | PASS |
| T11.3 | 重新练习跳转 | URL含/practice-answer | PASS |

### SECTION 12: ScoringGuide
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T12.1 | 评分标准页加载 | 显示评分标准内容 | PASS |
| T12.2 | 返回按钮 | 按钮可见 | PASS |
| T12.3 | 返回跳转 | URL含/practice | PASS |

### SECTION 13: History Clear
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T13.1 | 清空按钮 | 按钮可见(有记录时) | PASS |
| T13.2 | 清空确认对话框 | 显示"确认清空" | PASS |
| T13.3 | 取消清空 | 点击取消关闭对话框 | PASS |
| T13.4 | 确认清空 | 清空后显示空状态 | PASS |

### SECTION 14: History Persistence
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T14.1 | localStorage记录数 | count>0 | PASS (count=1) |
| T14.2 | 历史页记录数 | >0条 | PASS (count=1) |
| T14.3 | 历史详情可访问 | URL含/history-detail | PASS |
| T14.4 | 历史详情内容 | 显示评分/成绩等 | PASS |

### SECTION 15: Responsive Layout
| ID | 描述 | 预期 | 结果 |
|----|------|------|------|
| T15.1 | 移动端视口 | width=390 | PASS (390x664) |
| T15.2 | 无水平滚动 | scrollWidth<=clientWidth | PASS |
| T15.3 | 底部导航栏 | nav可见 | PASS |

## 已知限制

以下功能在 headless 测试环境中无法自动化验证，需在真实手机浏览器上手动测试:

1. **MediaRecorder 录音** — headless 浏览器不支持 getUserMedia API
2. **语音识别 (ASR)** — 需要 webkitSpeechRecognition 支持
3. **音频文件播放** — headless 模式下音频不实际播放声音
4. **PWA Service Worker** — 需要 HTTPS 或 localhost 环境
5. **TWA App 地址栏隐藏** — 需要 Android TWA 配置验证

## 修复历史

| 日期 | Commit | 修复内容 |
|------|--------|---------|
| 2026-08-16 | 5e5cc4b | 录音错误处理增强 - 支持NotSupportedError/AbortError及mediaDevices不存在场景 |
| 2026-08-16 | 3a2073f | 加固navigate函数，TWA WebView中hashchange fallback + SW缓存v11 |
| 2026-08-16 | 7868b04 | SW 强制更新机制解决手机端看不到新代码 |
| 2026-08-16 | a5bf7c2 | 修复播放听力时点击停止不生效 |
| 2026-08-16 | e28fe4c | 修复移动端音频播放和录音功能 |
