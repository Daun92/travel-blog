import { config } from 'dotenv';
import chalk from 'chalk';

config(); // Load .env

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const AGENT_ID = process.env.MOLTBOOK_AGENT_ID!;
const AGENT_NAME = process.env.MOLTBOOK_AGENT_NAME!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

interface ApiTestResult {
  endpoint: string;
  status: number;
  success: boolean;
  data?: any;
  error?: string;
}

async function testEndpoint(endpoint: string, method: string = 'GET'): Promise<ApiTestResult> {
  try {
    console.log(chalk.blue(`\n🔍 Testing: ${method} ${endpoint}`));

    const response = await fetch(`${MOLTBOOK_API}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(chalk.gray(`Status: ${response.status} ${response.statusText}`));

    if (response.ok) {
      console.log(chalk.green(`✅ Success`));
      console.log(chalk.gray('Response:'), JSON.stringify(data, null, 2).substring(0, 500));
      return { endpoint, status: response.status, success: true, data };
    } else {
      console.log(chalk.red(`❌ Failed`));
      console.log(chalk.gray('Error:'), JSON.stringify(data, null, 2));
      return { endpoint, status: response.status, success: false, error: JSON.stringify(data) };
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error}`));
    return { endpoint, status: 0, success: false, error: String(error) };
  }
}

async function diagnoseMoltbookAPI() {
  console.log(chalk.bold.cyan('\n🔧 Moltbook API 진단 시작\n'));
  console.log(chalk.gray('API Key:'), API_KEY ? '✅ 설정됨' : '❌ 없음');
  console.log(chalk.gray('Agent ID:'), AGENT_ID || '❌ 없음');
  console.log(chalk.gray('Agent Name:'), AGENT_NAME || '❌ 없음');

  const endpoints = [
    '/agents/me',
    `/agents/${AGENT_ID}`,
    `/agents/${AGENT_ID}/posts`,
    `/agents/${AGENT_NAME}/posts`,
    '/posts?author=' + AGENT_ID,
    '/posts?author=' + AGENT_NAME,
  ];

  const results: ApiTestResult[] = [];

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }

  console.log(chalk.bold.cyan('\n\n📊 진단 결과 요약\n'));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log(chalk.green(`✅ 성공: ${successful.length}개 엔드포인트`));
    successful.forEach(r => {
      console.log(chalk.green(`  - ${r.endpoint}`));
      if (r.data && typeof r.data === 'object') {
        const keys = Object.keys(r.data);
        console.log(chalk.gray(`    응답 필드: ${keys.join(', ')}`));
      }
    });
  }

  if (failed.length > 0) {
    console.log(chalk.red(`\n❌ 실패: ${failed.length}개 엔드포인트`));
    failed.forEach(r => {
      console.log(chalk.red(`  - ${r.endpoint} (${r.status})`));
    });
  }

  console.log(chalk.bold.cyan('\n\n💡 추천 해결방안\n'));

  const meEndpoint = results.find(r => r.endpoint === '/agents/me' && r.success);
  if (meEndpoint?.data) {
    console.log(chalk.yellow('1. /agents/me 응답 구조 확인:'));
    console.log(JSON.stringify(meEndpoint.data, null, 2));

    if (meEndpoint.data.agent && !meEndpoint.data.agent.recentPosts) {
      console.log(chalk.yellow('\n⚠️ recentPosts 필드가 없습니다.'));
      console.log(chalk.yellow('   대안 엔드포인트를 찾거나 Moltbook API 문서를 확인해야 합니다.'));
    }
  }
}

diagnoseMoltbookAPI().catch(console.error);
