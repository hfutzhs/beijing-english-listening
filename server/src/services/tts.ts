import { TTSClient, Config, HeaderUtils, S3Storage } from "coze-coding-dev-sdk";
import axios from "axios";
import type { Request } from "express";

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * Generate TTS audio for any text and return the object storage key.
 * Uses a cacheKey to avoid regenerating the same audio.
 */
export async function generateTTSAudio(
  text: string,
  cacheId: string,
  req: Request
): Promise<string> {
  const customHeaders = HeaderUtils.extractForwardHeaders(
    req.headers as Record<string, string>
  );
  const config = new Config();
  const ttsClient = new TTSClient(config, customHeaders);

  const response = await ttsClient.synthesize({
    uid: `tts_${cacheId}`,
    text: text,
    speaker: "zh_female_vv_uranus_bigtts",
    audioFormat: "mp3",
    sampleRate: 24000,
    speechRate: 0,
    loudnessRate: 0,
  });

  const audioData = await axios.get(response.audioUri, {
    responseType: "arraybuffer",
  });
  const audioBuffer = Buffer.from(audioData.data);

  const fileName = `tts-audio/tts_${cacheId}.mp3`;
  const storageKey = await storage.uploadFile({
    fileContent: audioBuffer,
    fileName,
    contentType: "audio/mpeg",
  });

  return storageKey;
}

/**
 * Generate a presigned URL for accessing audio.
 */
export async function getTTSAudioUrl(storageKey: string): Promise<string> {
  return storage.generatePresignedUrl({
    key: storageKey,
    expireTime: 3600,
  });
}
