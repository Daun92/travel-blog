import 'dotenv/config';

const key = process.env.KTO_API_KEY;
if (!key) { console.log('NO KEY'); process.exit(1); }

const url = `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${key}&numOfRows=3&pageNo=1&MobileOS=ETC&MobileApp=OpenClaw&_type=json&keyword=${encodeURIComponent('경복궁')}&contentTypeId=12`;

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  console.log('status:', res.status);
  const text = await res.text();
  console.log('response:', text.substring(0, 600));
} catch (e: any) {
  console.error('Error:', e.message);
}
