import { ASRClient, LLMClient, Config, HeaderUtils, S3Storage } from "coze-coding-dev-sdk";
import type { Request } from "express";

// Initialize S3 storage
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// ==================== 朗读短文评分 (满分9分) ====================
const READ_ALOUD_PROMPT = `你是一名北京市中考英语听说考试的阅卷专家，专门负责"朗读短文"题型的评分。

## 评分标准（北京市中考英语听说考试 - 朗读短文，满分9分）

### 评分档次：
- 9分档：朗读完整，覆盖全部文本内容；语音标准，只有极个别轻微错误；语调自然，语流顺畅，节奏感好，基本没有不必要的停顿。
- 7-8分档：朗读完整，没有漏读；有少量语音错误，但不影响理解；语调和流利度基本自然，但节奏感略欠佳，个别地方停顿稍多或不够流畅。
- 5-6分档：朗读基本完整，但存在多处语音、语调错误；节奏感欠佳，流畅度有一定问题，有较明显的不自然停顿或卡顿。
- 3-4分档：只能朗读部分内容，完整性较差；语音错误较多，语调不自然，流利度差，多处卡顿或断句错误。
- 0-2分档：只朗读了个别词语或短语，基本无法完成朗读；语音、语调、节奏均存在严重问题，或完全无法朗读。

### 评分维度：
1. 准确度：加音、吞音、辅音不到位、元音不饱满、重音错位
2. 流畅度：语调不正确、节奏不正确、未正确意群停顿、未正确连读、未正确失去爆破、生难词卡顿
3. 完整度：短语/句子未读完、漏词跳词、吞音

### 评分原则：
1. 满分档引入容错机制
2. 档内从宽
3. 个别错误指1-2个
4. 如出现与作答无关的语音，做异常卷标记

## 你的任务：
根据学生的语音识别文本（ASR转写结果）与原文进行对比分析，按照上述评分标准进行评分。

## 输出格式（严格JSON，不要包含markdown代码块标记）：
{
  "score": <0-9的整数>,
  "scoreLevel": "<档次描述>",
  "accuracyAnalysis": "<准确度分析，中文>",
  "fluencyAnalysis": "<流畅度分析，中文>",
  "completenessAnalysis": "<完整度分析，中文>",
  "specificIssues": "<具体问题列表，分号分隔，中文>",
  "suggestions": "<改进建议，中文>"
}`;

// ==================== 听后回答评分 (满分12分，每题2分) ====================
const LISTEN_ANSWER_PROMPT = `你是一名北京市中考英语听说考试的阅卷专家，专门负责"听后回答"题型的评分。

## 评分标准（北京市中考英语听说考试 - 听后回答，满分12分，每题2分）

### 评分原则：
1. 发音若不准确，但只要不影响理解，不扣分
2. 表达如有语法错误，但只要能说出关键词，不影响理解，不扣分
3. 不做答或所答与对话内容完全无关，不得分
4. 录音中出现多题答案，以最后答案为准
5. 零误差（关键词必须正确）

### 评分维度：
1. 内容准确性：是否回答了问题，答案是否正确
2. 关键词匹配：是否包含答案的关键词
3. 语法正确性：语法是否正确（但不影响理解不扣分）

## 你的任务：
根据学生的语音识别文本（ASR转写结果）与参考答案进行对比分析评分。

## 输出格式（严格JSON，不要包含markdown代码块标记）：
{
  "score": <0-2的整数>,
  "isCorrect": <true/false>,
  "keywordMatch": "<学生回答中匹配到的关键词，或'未匹配到关键词'>",
  "analysis": "<分析学生的回答是否正确，指出问题，中文>",
  "suggestions": "<改进建议，中文>"
}`;

// ==================== 听后转述评分 (满分10分) ====================
const LISTEN_RETELL_PROMPT = `你是一名北京市中考英语听说考试的阅卷专家，专门负责"听后转述"题型的评分。

## 评分标准（北京市中考英语听说考试 - 听后转述，满分10分）

### 评分原则：
1. 拼写错误不得分（但语音回答中按发音判断）
2. 单复数扣分，大小写错误不扣分
3. 出现多余信息，但不影响交际不扣分
4. 要遵循交际原则，意思等值可给分

### 评分维度：
1. 信息完整度：是否覆盖所有信息点
2. 语言准确性：语法、词汇使用是否正确
3. 连贯性：转述是否连贯、逻辑是否清晰
4. 语音语调：发音是否清晰、语调是否自然

### 评分档次：
- 9-10分档：覆盖全部信息点，语言准确，连贯性好，语音语调自然
- 7-8分档：覆盖大部分信息点，语言基本准确，连贯性较好
- 5-6分档：覆盖部分信息点，语言有一些错误但不影响理解
- 3-4分档：信息点覆盖较少，语言错误较多
- 0-2分档：基本未转述或完全无法理解

## 你的任务：
根据学生的语音识别文本（ASR转写结果）与信息点进行对比分析评分。

## 输出格式（严格JSON，不要包含markdown代码块标记）：
{
  "score": <0-10的整数>,
  "scoreLevel": "<档次描述>",
  "coveredPoints": ["<已覆盖的信息点1>", "<已覆盖的信息点2>"],
  "missingPoints": ["<遗漏的信息点1>", "<遗漏的信息点2>"],
  "languageAnalysis": "<语言准确性分析，中文>",
  "coherenceAnalysis": "<连贯性分析，中文>",
  "suggestions": "<改进建议，中文>"
}`;

export interface ReadAloudResult {
  score: number;
  scoreLevel: string;
  accuracyAnalysis: string;
  fluencyAnalysis: string;
  completenessAnalysis: string;
  specificIssues: string;
  suggestions: string;
}

export interface ListenAnswerResult {
  score: number;
  isCorrect: boolean;
  keywordMatch: string;
  analysis: string;
  suggestions: string;
}

export interface ListenRetellResult {
  score: number;
  scoreLevel: string;
  coveredPoints: string[];
  missingPoints: string[];
  languageAnalysis: string;
  coherenceAnalysis: string;
  suggestions: string;
}

/**
 * Upload audio buffer to object storage and return the storage key
 */
export async function uploadAudio(
  audioBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = await storage.uploadFile({
    fileContent: audioBuffer,
    fileName: `exam-audio/${fileName}`,
    contentType,
  });
  return key;
}

/**
 * Transcribe audio using ASR
 */
export async function transcribeAudio(
  audioUrl: string,
  req: Request
): Promise<string> {
  const config = new Config();
  const customHeaders = HeaderUtils.extractForwardHeaders(
    req.headers as Record<string, string>
  );
  const asrClient = new ASRClient(config, customHeaders);

  const result = await asrClient.recognize({
    uid: "exam-user",
    url: audioUrl,
  });

  return result.text || "";
}

/**
 * Score read aloud using LLM
 */
export async function scoreReading(
  originalPassage: string,
  transcription: string,
  req: Request
): Promise<ReadAloudResult> {
  const config = new Config();
  const customHeaders = HeaderUtils.extractForwardHeaders(
    req.headers as Record<string, string>
  );
  const llmClient = new LLMClient(config, customHeaders);

  const userMessage = `请根据以下信息进行评分：

## 原文（学生需要朗读的短文）：
${originalPassage}

## 学生朗读的语音识别结果（ASR转写）：
${transcription || "（无法识别到语音内容）"}

请按照北京市中考英语听说考试朗读短文的评分标准，对学生朗读进行评分和分析。请严格输出JSON格式。`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: READ_ALOUD_PROMPT },
    { role: "user", content: userMessage },
  ];

  const response = await llmClient.invoke(messages, {
    model: "doubao-seed-2-0-pro-260215",
    temperature: 0.3,
  });

  let content = response.content.trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const result = JSON.parse(content);
    return {
      score: Math.max(0, Math.min(9, Math.round(result.score || 0))),
      scoreLevel: result.scoreLevel || "未评定",
      accuracyAnalysis: result.accuracyAnalysis || "暂无分析",
      fluencyAnalysis: result.fluencyAnalysis || "暂无分析",
      completenessAnalysis: result.completenessAnalysis || "暂无分析",
      specificIssues: result.specificIssues || "暂无问题",
      suggestions: result.suggestions || "暂无建议",
    };
  } catch {
    console.error("Failed to parse LLM response as JSON:", content);
    return {
      score: 0,
      scoreLevel: "评分失败",
      accuracyAnalysis: "评分系统暂时无法处理，请重试",
      fluencyAnalysis: "评分系统暂时无法处理，请重试",
      completenessAnalysis: "评分系统暂时无法处理，请重试",
      specificIssues: "评分解析失败",
      suggestions: "请重新提交朗读录音",
    };
  }
}

/**
 * Score listen answer using LLM
 */
export async function scoreListenAnswer(
  question: string,
  sampleAnswer: string,
  keywords: string[],
  transcription: string,
  req: Request
): Promise<ListenAnswerResult> {
  const config = new Config();
  const customHeaders = HeaderUtils.extractForwardHeaders(
    req.headers as Record<string, string>
  );
  const llmClient = new LLMClient(config, customHeaders);

  const userMessage = `请根据以下信息进行评分：

## 问题：
${question}

## 参考答案：
${sampleAnswer}

## 答案关键词：
${keywords.join(", ")}

## 学生的语音回答（ASR转写）：
${transcription || "（无法识别到语音内容）"}

请按照北京市中考英语听说考试听后回答的评分标准评分。每题满分2分。请严格输出JSON格式。`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: LISTEN_ANSWER_PROMPT },
    { role: "user", content: userMessage },
  ];

  const response = await llmClient.invoke(messages, {
    model: "doubao-seed-2-0-pro-260215",
    temperature: 0.3,
  });

  let content = response.content.trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const result = JSON.parse(content);
    return {
      score: Math.max(0, Math.min(2, Math.round(result.score || 0))),
      isCorrect: result.isCorrect ?? false,
      keywordMatch: result.keywordMatch || "未匹配到关键词",
      analysis: result.analysis || "暂无分析",
      suggestions: result.suggestions || "暂无建议",
    };
  } catch {
    console.error("Failed to parse LLM response as JSON:", content);
    return {
      score: 0,
      isCorrect: false,
      keywordMatch: "评分解析失败",
      analysis: "评分系统暂时无法处理，请重试",
      suggestions: "请重新提交录音",
    };
  }
}

/**
 * Score listen retell using LLM
 */
export async function scoreListenRetell(
  topic: string,
  intro: string,
  infoPoints: Array<{ label: string; answer: string }>,
  transcription: string,
  req: Request
): Promise<ListenRetellResult> {
  const config = new Config();
  const customHeaders = HeaderUtils.extractForwardHeaders(
    req.headers as Record<string, string>
  );
  const llmClient = new LLMClient(config, customHeaders);

  const pointsDesc = infoPoints.map((p, i) => `${i + 1}. ${p.label}: ${p.answer}`).join("\n");

  const userMessage = `请根据以下信息进行评分：

## 转述主题：
${topic}

## 背景介绍：
${intro}

## 需要覆盖的信息点：
${pointsDesc}

## 学生的语音转述（ASR转写）：
${transcription || "（无法识别到语音内容）"}

请按照北京市中考英语听说考试听后转述的评分标准评分。满分10分。请严格输出JSON格式。`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: LISTEN_RETELL_PROMPT },
    { role: "user", content: userMessage },
  ];

  const response = await llmClient.invoke(messages, {
    model: "doubao-seed-2-0-pro-260215",
    temperature: 0.3,
  });

  let content = response.content.trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const result = JSON.parse(content);
    return {
      score: Math.max(0, Math.min(10, Math.round(result.score || 0))),
      scoreLevel: result.scoreLevel || "未评定",
      coveredPoints: Array.isArray(result.coveredPoints) ? result.coveredPoints : [],
      missingPoints: Array.isArray(result.missingPoints) ? result.missingPoints : [],
      languageAnalysis: result.languageAnalysis || "暂无分析",
      coherenceAnalysis: result.coherenceAnalysis || "暂无分析",
      suggestions: result.suggestions || "暂无建议",
    };
  } catch {
    console.error("Failed to parse LLM response as JSON:", content);
    return {
      score: 0,
      scoreLevel: "评分失败",
      coveredPoints: [],
      missingPoints: infoPoints.map((p) => p.label),
      languageAnalysis: "评分系统暂时无法处理，请重试",
      coherenceAnalysis: "评分系统暂时无法处理，请重试",
      suggestions: "请重新提交录音",
    };
  }
}

/**
 * Generate presigned URL for audio playback
 */
export async function getAudioUrl(audioKey: string): Promise<string> {
  return await storage.generatePresignedUrl({
    key: audioKey,
    expireTime: 86400,
  });
}
