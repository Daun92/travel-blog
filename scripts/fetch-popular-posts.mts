import { config } from 'dotenv';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

config();

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
const GA_CREDENTIALS_PATH = process.env.GA_CREDENTIALS_PATH || './config/ga-credentials.json';

interface GARow {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

interface GAResponse {
  rows?: GARow[];
}

interface PopularPost {
  path: string;
  slug: string;
  pageViews: number;
  title: string;
}

interface PopularData {
  lastUpdated: string;
  period: { startDate: string; endDate: string; days: number };
  posts: PopularPost[];
}

const OUTPUT_PATH = resolve('blog/data/popular.json');

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 30;
  let limit = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { days, limit };
}

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { startDate: fmt(start), endDate: fmt(end) };
}

function extractSlug(path: string): string {
  const cleaned = path.replace(/\/$/, '');
  const parts = cleaned.split('/');
  return parts[parts.length - 1] || '';
}

async function fetchFromGA(days: number, limit: number): Promise<PopularPost[]> {
  if (!GA_PROPERTY_ID) {
    console.log('⚠️  GA_PROPERTY_ID not set. Skipping GA fetch.');
    return [];
  }

  const credPath = resolve(GA_CREDENTIALS_PATH);
  if (!existsSync(credPath)) {
    console.log(`⚠️  GA credentials file not found: ${credPath}`);
    console.log('   See CLAUDE.md for setup instructions.');
    return [];
  }

  let BetaAnalyticsDataClient: typeof import('@google-analytics/data').BetaAnalyticsDataClient;
  try {
    const mod = await import('@google-analytics/data');
    BetaAnalyticsDataClient = mod.BetaAnalyticsDataClient;
  } catch {
    console.log('⚠️  @google-analytics/data not installed.');
    console.log('   Run: npm install @google-analytics/data');
    return [];
  }

  const client = new BetaAnalyticsDataClient({
    keyFilename: credPath,
  });

  const { startDate, endDate } = getDateRange(days);

  console.log(`📊 Fetching GA data: ${startDate} ~ ${endDate} (${days} days)`);

  const [response] = await client.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' },
    ],
    metrics: [
      { name: 'screenPageViews' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: {
          matchType: 'BEGINS_WITH' as const,
          value: '/travel-blog/posts/',
        },
      },
    },
    orderBys: [
      { metric: { metricName: 'screenPageViews' }, desc: true },
    ],
    limit,
  });

  const gaResponse = response as GAResponse;
  if (!gaResponse.rows || gaResponse.rows.length === 0) {
    console.log('ℹ️  No page view data found for the period.');
    return [];
  }

  return gaResponse.rows.map((row) => ({
    path: row.dimensionValues[0].value,
    slug: extractSlug(row.dimensionValues[0].value),
    pageViews: parseInt(row.metricValues[0].value, 10),
    title: row.dimensionValues[1].value,
  }));
}

async function main() {
  const { days, limit } = parseArgs();

  let posts: PopularPost[] = [];

  try {
    posts = await fetchFromGA(days, limit);
  } catch (err) {
    console.error('❌ GA API error:', (err as Error).message);
    console.log('   Falling back to empty data.');
  }

  const { startDate, endDate } = getDateRange(days);
  const data: PopularData = {
    lastUpdated: new Date().toISOString(),
    period: { startDate, endDate, days },
    posts,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf-8');

  if (posts.length > 0) {
    console.log(`✅ Saved ${posts.length} popular posts to blog/data/popular.json`);
    posts.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.title} (${p.pageViews} views)`);
    });
  } else {
    console.log('✅ Saved empty popular.json (no data yet).');
  }
}

main();
