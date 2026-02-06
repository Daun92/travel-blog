/**
 * Moltbook 순환 스케줄러
 * 1. 공유 → 2. 30분 대기 → 3. 피드백 확인 → 4. 반복
 */

import { config } from 'dotenv';
import { spawn } from 'child_process';

config();

const CYCLE_MINUTES = 30;
const CHECK_INTERVAL = 5; // 5분마다 상태 확인

interface CycleLog {
  cycle: number;
  action: string;
  time: string;
  result: string;
}

const log: CycleLog[] = [];

function logAction(cycle: number, action: string, result: string) {
  const entry: CycleLog = {
    cycle,
    action,
    time: new Date().toISOString(),
    result
  };
  log.push(entry);

  console.log(`\n[Cycle ${cycle}] ${action}: ${result}`);
  console.log(`⏰ ${new Date().toLocaleString('ko-KR')}\n`);
}

async function runCommand(command: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npm', ['run', command], {
      shell: true,
      stdio: 'inherit'
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: code === 0 ? 'Success' : 'Failed'
      });
    });
  });
}

async function sleep(minutes: number) {
  console.log(`\n⏳ ${minutes}분 대기 중...`);
  console.log(`다음 실행: ${new Date(Date.now() + minutes * 60 * 1000).toLocaleString('ko-KR')}\n`);

  // 5분마다 남은 시간 표시
  const intervals = Math.floor(minutes / CHECK_INTERVAL);
  for (let i = 0; i < intervals; i++) {
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL * 60 * 1000));
    const remaining = minutes - (i + 1) * CHECK_INTERVAL;
    if (remaining > 0) {
      console.log(`⏱️  ${remaining}분 남음...`);
    }
  }

  // 나머지 시간 대기
  const remainingMs = (minutes % CHECK_INTERVAL) * 60 * 1000;
  if (remainingMs > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingMs));
  }
}

async function main() {
  console.log('🚀 Moltbook 순환 스케줄러 시작\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('워크플로우:');
  console.log('  1. 포스트 공유');
  console.log('  2. 30분 대기');
  console.log('  3. 피드백 확인');
  console.log('  4. 반복\n');
  console.log('중지: Ctrl+C');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let cycle = 1;
  let consecutiveFailures = 0;

  while (true) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`   🔄 CYCLE ${cycle} 시작`);
    console.log(`${'='.repeat(50)}\n`);

    // 1. 상태 확인
    console.log('📊 Step 1: 상태 확인\n');
    await runCommand('moltbook:status');

    // 2. 포스트 공유
    console.log('\n📝 Step 2: 포스트 공유\n');
    const shareResult = await runCommand('moltbook:once');

    if (shareResult.success) {
      logAction(cycle, 'Share', 'Success');
      consecutiveFailures = 0;
    } else {
      logAction(cycle, 'Share', 'Failed - Rate limit or error');
      consecutiveFailures++;

      if (consecutiveFailures >= 3) {
        console.log('\n⚠️  3회 연속 실패 - 더 긴 대기 시간 적용');
        await sleep(60); // 60분 대기
        consecutiveFailures = 0;
        continue;
      }
    }

    // 3. 30분 대기
    console.log(`\n⏰ Step 3: ${CYCLE_MINUTES}분 대기\n`);
    await sleep(CYCLE_MINUTES);

    // 4. 피드백 확인
    console.log('\n💬 Step 4: 피드백 확인\n');
    await runCommand('moltbook:feedback');

    // 사이클 요약
    console.log(`\n${'='.repeat(50)}`);
    console.log(`   ✅ CYCLE ${cycle} 완료`);
    console.log(`${'='.repeat(50)}\n`);

    cycle++;

    // 로그 출력 (최근 5개)
    if (log.length > 0) {
      console.log('\n📋 최근 활동:\n');
      log.slice(-5).forEach((entry) => {
        const time = new Date(entry.time).toLocaleTimeString('ko-KR');
        console.log(`  [Cycle ${entry.cycle}] ${time} - ${entry.action}: ${entry.result}`);
      });
      console.log('');
    }

    // 다음 사이클까지 짧은 대기 (버퍼)
    await sleep(2);
  }
}

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n\n🛑 스케줄러 종료\n');
  console.log('📊 총 실행 사이클:', log.length);
  console.log('✅ 공유 성공:', log.filter(l => l.result === 'Success').length);
  console.log('');
  process.exit(0);
});

main().catch((error) => {
  console.error('\n❌ 오류 발생:', error);
  process.exit(1);
});
