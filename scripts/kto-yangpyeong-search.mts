import 'dotenv/config';
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
const c = getDataGoKrClient();

console.log('=== 양평 관광지 전체 검색 ===');
const items = await c.searchKeyword('양평', { contentTypeId: '12', numOfRows: 20 });
for (const i of items) {
  console.log(`"${i.title}" | ${i.addr1 || 'N/A'} | ${i.firstimage ? 'IMG' : 'NO_IMG'}`);
}

console.log('\n=== 두물머리 검색 ===');
const items2 = await c.searchKeyword('두물머리', { contentTypeId: '12', numOfRows: 5 });
for (const i of items2) {
  console.log(`"${i.title}" | ${i.addr1 || 'N/A'} | ${i.firstimage ? 'IMG' : 'NO_IMG'}`);
}

console.log('\n=== 세미원 검색 ===');
const items3 = await c.searchKeyword('세미원', { contentTypeId: '12', numOfRows: 5 });
for (const i of items3) {
  console.log(`"${i.title}" | ${i.addr1 || 'N/A'} | ${i.firstimage ? 'IMG' : 'NO_IMG'}`);
}
