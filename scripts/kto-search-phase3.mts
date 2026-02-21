import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

const client = getDataGoKrClient();
const keywords = ['남해독일마을', '독일마을', '파주프로방스', '프로방스마을', '쁘띠프랑스', '광교산', '수리산', '칠보산', '물왕저수지'];

for (const kw of keywords) {
  try {
    const items = await client.searchKeyword(kw, { numOfRows: 5 });
    console.log(`\n=== ${kw} === ${items.length}건`);
    for (const item of items.slice(0, 5)) {
      console.log(`  - ${item.title} | id: ${item.contentid} | img: ${item.firstimage ? 'YES' : 'NO'} | addr: ${item.addr1 || 'N/A'}`);
      if (item.firstimage) console.log(`    imgUrl: ${item.firstimage}`);
    }
  } catch(e: any) {
    console.log(`\n=== ${kw} === ERROR: ${e.message}`);
  }
}
