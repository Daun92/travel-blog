/**
 * KTO 후보 이미지 미리보기 다운로드 (data/cover-preview/ 임시 저장)
 */
import { config } from 'dotenv'; config();
import * as fs from 'fs';

const OUT = 'data/cover-preview/danyang';
fs.mkdirSync(OUT, { recursive: true });

async function dl(url: string, name: string) {
  const res = await fetch(url);
  if (!res.ok) { console.log(`FAIL ${res.status}: ${name}`); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(`${OUT}/${name}`, buf);
  console.log(`OK: ${name} (${Math.round(buf.length/1024)}KB)`);
}

async function main() {
  // 관광특구 8장
  const touristUrls = [
    'http://tong.visitkorea.or.kr/cms/resource/22/3081022_image2_1.jpg',
    'http://tong.visitkorea.or.kr/cms/resource/23/3081023_image2_1.jpg',
    'http://tong.visitkorea.or.kr/cms/resource/24/3081024_image2_1.jpg',
    'http://tong.visitkorea.or.kr/cms/resource/25/3081025_image2_1.jpg',
    'http://tong.visitkorea.or.kr/cms/resource/26/3081026_image2_1.jpg',
    'http://tong.visitkorea.or.kr/cms/resource/29/3081029_image2_1.jpg',
    'http://tong.visitkorea.or.kr/cms/resource/30/3081030_image2_1.jpg',
    'http://tong.visitkorea.or.kr/cms/resource/35/3081035_image2_1.jpg',
  ];
  for (let i = 0; i < touristUrls.length; i++) {
    await dl(touristUrls[i], `tourist-${i+1}.jpg`);
  }

  // 바람개비마을 4장
  const villageUrls = [
    'http://tong.visitkorea.or.kr/cms/resource/11/3377911_image2_1.JPG',
    'http://tong.visitkorea.or.kr/cms/resource/12/3377912_image2_1.JPG',
    'http://tong.visitkorea.or.kr/cms/resource/13/3377913_image2_1.JPG',
    'http://tong.visitkorea.or.kr/cms/resource/14/3377914_image2_1.JPG',
  ];
  for (let i = 0; i < villageUrls.length; i++) {
    await dl(villageUrls[i], `village-${i+1}.JPG`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
