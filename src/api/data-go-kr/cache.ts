/**
 * data.go.kr API 응답 파일 기반 캐시
 * - SHA-256 키 기반
 * - TTL 만료 관리
 * - data/api-cache/ 디렉토리 자동 생성
 */

import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { CacheEntry, CacheTtlConfig } from './types.js';

export const DEFAULT_TTL: CacheTtlConfig = {
  search: 3600,        // 1시간
  detail: 21600,       // 6시간
  code: 2592000,       // 30일
  festival: 1800,      // 30분
};

export class ApiCache {
  private readonly cacheDir: string;
  private readonly ttlConfig: CacheTtlConfig;

  constructor(cacheDir: string = 'data/api-cache', ttlConfig?: Partial<CacheTtlConfig>) {
    this.cacheDir = cacheDir;
    this.ttlConfig = { ...DEFAULT_TTL, ...ttlConfig };
  }

  /**
   * 캐시에서 조회
   * @returns 캐시 히트 시 데이터, 미스 시 null
   */
  async get<T>(key: string): Promise<T | null> {
    const filePath = this.keyToPath(key);

    try {
      const raw = await readFile(filePath, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry<T>;

      // TTL 만료 체크
      if (new Date(entry.expiresAt) < new Date()) {
        // 만료 → 삭제
        await unlink(filePath).catch(() => {});
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * 캐시에 저장
   * @param category TTL 카테고리 (search, detail, code, festival)
   */
  async set<T>(key: string, data: T, category: keyof CacheTtlConfig = 'search'): Promise<void> {
    const filePath = this.keyToPath(key);
    const ttl = this.ttlConfig[category];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const entry: CacheEntry<T> = {
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ttl,
      data,
    };

    try {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(filePath, JSON.stringify(entry, null, 2));
    } catch (err) {
      console.warn('캐시 저장 실패:', err);
    }
  }

  /** 만료된 캐시 정리 */
  async cleanup(): Promise<number> {
    let cleaned = 0;

    try {
      const files = await readdir(this.cacheDir);
      const now = new Date();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.cacheDir, file);
        try {
          const raw = await readFile(filePath, 'utf-8');
          const entry = JSON.parse(raw) as CacheEntry;
          if (new Date(entry.expiresAt) < now) {
            await unlink(filePath);
            cleaned++;
          }
        } catch {
          // 파싱 실패 파일도 삭제
          await unlink(filePath).catch(() => {});
          cleaned++;
        }
      }
    } catch {
      // 디렉토리 없으면 무시
    }

    return cleaned;
  }

  /** 전체 캐시 삭제 */
  async clear(): Promise<number> {
    let cleared = 0;

    try {
      const files = await readdir(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        await unlink(join(this.cacheDir, file)).catch(() => {});
        cleared++;
      }
    } catch {
      // 디렉토리 없으면 무시
    }

    return cleared;
  }

  /** 캐시 통계 */
  async stats(): Promise<{ total: number; sizeBytes: number }> {
    let total = 0;
    let sizeBytes = 0;

    try {
      const files = await readdir(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        total++;
        const fileStat = await stat(join(this.cacheDir, file));
        sizeBytes += fileStat.size;
      }
    } catch {
      // 디렉토리 없으면 0
    }

    return { total, sizeBytes };
  }

  // ─────────────────────────────────────────────
  // 내부 메서드
  // ─────────────────────────────────────────────

  private keyToPath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return join(this.cacheDir, `${hash}.json`);
  }
}
