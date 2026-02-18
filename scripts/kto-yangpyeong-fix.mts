import 'dotenv/config';
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = 'blog/static/images';

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, buffer);
    return true;
  } catch { return false; }
}

async function main() {
  const c = getDataGoKrClient();

  // 양평 두물머리 → vs-3 (남한강 강변)
  const path3 = join(OUTPUT_DIR, 'kto-2026-02-18-vs-3.jpg');
  if (existsSync(path3)) await unlink(path3);

  const items = await c.searchKeyword('두물머리', { contentTypeId: '12', numOfRows: 5 });
  const match = items.find((i: any) => i.title?.includes('두물머리') && i.firstimage);
  if (match?.firstimage) {
    const ok = await downloadImage(match.firstimage, path3);
    console.log(ok ? `✅ "${match.title}" → kto-2026-02-18-vs-3.jpg` : '❌ 다운로드 실패');
  }
}

main().catch(console.error);
