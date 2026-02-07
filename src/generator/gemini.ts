/**
 * LLM API 클라이언트 (Google Gemini)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface LLMConfig {
  apiKey: string;
  model: string;
}

export interface LLMResponse {
  model: string;
  response: string;
  done: boolean;
}

export interface GenerateOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

function getDefaultConfig(): LLMConfig {
  return {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    model: process.env.LLM_MODEL || 'gemini-3.0-flash'
  };
}

let genAI: GoogleGenerativeAI | null = null;
let clientApiKey: string | null = null;

function getClient(config?: LLMConfig): GoogleGenerativeAI {
  const cfg = config || getDefaultConfig();

  if (!genAI || clientApiKey !== cfg.apiKey) {
    if (!cfg.apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    genAI = new GoogleGenerativeAI(cfg.apiKey);
    clientApiKey = cfg.apiKey;
  }
  return genAI;
}

/**
 * LLM 서버 상태 확인
 */
export async function checkGeminiStatus(config?: LLMConfig): Promise<boolean> {
  try {
    const cfg = config || getDefaultConfig();
    if (!cfg.apiKey) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 사용 가능한 모델 목록 조회
 */
export async function listModels(config?: LLMConfig): Promise<string[]> {
  return [
    'gemini-3.0-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];
}

/**
 * 텍스트 생성
 */
export async function generate(
  prompt: string,
  options: GenerateOptions = {},
  config?: LLMConfig
): Promise<string> {
  const cfg = config || getDefaultConfig();
  const {
    temperature = 0.7,
    max_tokens = 4096
  } = options;

  const client = getClient(cfg);
  const model = client.getGenerativeModel({
    model: cfg.model,
    generationConfig: {
      temperature,
      maxOutputTokens: max_tokens
    }
  });

  // /no_think 접미사 제거 (레거시)
  const cleanPrompt = prompt.replace(/\s*\/no_think\s*$/, '');

  const result = await model.generateContent(cleanPrompt);
  const response = result.response;
  return response.text();
}

/**
 * 스트리밍 생성 (콜백)
 */
export async function generateStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  options: Omit<GenerateOptions, 'stream'> = {},
  config?: LLMConfig
): Promise<string> {
  const cfg = config || getDefaultConfig();
  const {
    temperature = 0.7,
    max_tokens = 4096
  } = options;

  const client = getClient(cfg);
  const model = client.getGenerativeModel({
    model: cfg.model,
    generationConfig: {
      temperature,
      maxOutputTokens: max_tokens
    }
  });

  const cleanPrompt = prompt.replace(/\s*\/no_think\s*$/, '');

  const result = await model.generateContentStream(cleanPrompt);

  let fullText = '';
  for await (const chunk of result.stream) {
    const text = chunk.text();
    fullText += text;
    onChunk(text);
  }

  return fullText;
}
