import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

async function main() {
  const client = getDataGoKrClient();
  const targets = [
    { name: '부평역사박물관', id: '130911' },
    { name: '부평모두몰', id: '2021033' },
    { name: '부평시장', id: '2768142' },
    { name: '부평깡통시장', id: '1878218' },
    { name: '부평아트센터', id: '3457385' },
    { name: '달빛가득 부평향교', id: '2816928' },
    { name: '부평공원', id: '126837' },
  ];

  for (const t of targets) {
    console.log(`\n=== ${t.name} (contentId: ${t.id}) ===`);
    
    // Detail images
    try {
      const imgs = await client.detailImage(t.id);
      console.log(`  DetailImage2: ${imgs.length} images`);
      for (const img of imgs) {
        console.log(`    ${(img as any).originimgurl || (img as any).smallimageurl}`);
      }
    } catch (e: any) { console.error('  DetailImage error:', e.message); }
    
    // Detail common (overview)
    try {
      const details = await client.detailCommon(t.id);
      if (details && details.length > 0) {
        const d = details[0] as any;
        console.log(`  Address: ${d.addr1 || 'N/A'}`);
        console.log(`  Homepage: ${d.homepage || 'N/A'}`);
        const overview = (d.overview || '').replace(/<[^>]+>/g, '').slice(0, 300);
        console.log(`  Overview: ${overview}...`);
      }
    } catch (e: any) { console.error('  DetailCommon error:', e.message); }
  }
}

main().catch(console.error);
