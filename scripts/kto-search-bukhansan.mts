import { config } from 'dotenv';
config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

const client = getDataGoKrClient();

// Get detail images for key content IDs
const targets = [
  { id: '2783363', name: '북한산 백운대(우이동)' },
  { id: '125550', name: '북한산성' },
  { id: '127220', name: '북한산국립공원(서울)' },
  { id: '2406564', name: '북한산 자락길' },
  { id: '2727279', name: '북한산 둘레캠프' },
  { id: '3534386', name: '북한산 사기막야영장' },
  { id: '3407173', name: '북한산 생태탐방원' },
];

for (const t of targets) {
  console.log(`\n=== ${t.name} (${t.id}) ===`);
  try {
    // Use string arg, not object
    const images = await client.detailImage(t.id);
    if (images.length === 0) {
      console.log('No images');
      continue;
    }
    console.log(`Found ${images.length} images:`);
    for (const img of images) {
      console.log(`  ${img.originimgurl} | small: ${img.smallimageurl || 'none'} | name: ${img.imgname || 'none'}`);
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

// Also try detailCommon to get firstimage
console.log('\n\n=== Detail Common (firstimage) ===');
for (const t of targets.slice(0, 3)) {
  try {
    const details = await client.detailCommon(t.id);
    if (details.length > 0) {
      const d = details[0];
      console.log(`${t.name}: firstimage=${d.firstimage || 'none'} | firstimage2=${d.firstimage2 || 'none'}`);
    }
  } catch (e: any) {
    console.log(`${t.name}: Error - ${e.message}`);
  }
}
