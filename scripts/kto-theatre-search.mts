import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

async function main() {
  const client = getDataGoKrClient();
  
  // detailImage for 대학로 (126534)
  console.log('=== 대학로 (126534) detailImage ===');
  const imgs = await client.detailImage('126534');
  if (imgs && imgs.length > 0) {
    imgs.forEach((img: any, i: number) => {
      console.log(`  [${i}] ${img.originimgurl || img.smallimageurl}`);
    });
  } else {
    console.log('  No detail images');
  }
  
  // Also try searchKeyword for 세종문화회관 (already have KTO image but check for more)
  console.log('\n=== 세종문화회관 searchKeyword ===');
  const sejong = await client.searchKeyword('세종문화회관', { numOfRows: 3 });
  if (sejong && sejong.length > 0) {
    for (const item of sejong) {
      console.log(`  ${item.title} (id:${item.contentid}) img: ${item.firstimage ? 'YES' : 'no'}`);
      if (item.contentid) {
        const dimgs = await client.detailImage(item.contentid);
        if (dimgs && dimgs.length > 0) {
          dimgs.forEach((img: any, i: number) => {
            console.log(`    detail[${i}]: ${img.originimgurl}`);
          });
        }
      }
    }
  }
}

main().catch(console.error);
