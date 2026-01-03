/**
 * Logseq Daily Note 자동 생성 스크립트
 * 매일 실행하여 오늘의 일기 템플릿 + 날씨 정보를 자동으로 추가
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { WeatherScraper } from './dist/weather-scraper.js';

// 설정
const LOGSEQ_GRAPH_PATH = process.env.LOGSEQ_GRAPH_PATH;
if (!LOGSEQ_GRAPH_PATH) {
  console.error('Error: LOGSEQ_GRAPH_PATH environment variable is required');
  process.exit(1);
}
const JOURNALS_PATH = join(LOGSEQ_GRAPH_PATH, 'journals');

/**
 * KST 기준 오늘 날짜 가져오기
 */
function getKSTDate() {
  const now = new Date();
  const kstOffset = 9 * 60; // KST는 UTC+9
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcTime + kstOffset * 60000);
}

/**
 * 날짜를 저널 파일명 형식으로 변환 (yyyy_MM_dd.md)
 */
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}.md`;
}

/**
 * 일기 템플릿 생성 (날씨 정보 포함)
 */
async function generateTemplate(weatherLines) {
  const lines = ['- [[일기]]'];

  // 날씨 섹션
  lines.push('\t- [[날씨]]');
  if (weatherLines && weatherLines.length > 0) {
    for (const line of weatherLines) {
      lines.push(`\t\t- ${line}`);
    }
  } else {
    lines.push('\t\t- 날씨 정보 없음');
  }

  // 오늘의 일기 섹션
  lines.push('\t- [[오늘의 일기]]');
  lines.push('\t\t- [[행복도]]');
  lines.push('\t\t- [[오늘의 행복]]');
  lines.push('\t\t- [[오늘의 컨디션]]');
  lines.push('\t\t- [[오늘 잘 해낸 일]]');
  lines.push('\t\t- [[오늘의 생각]]');

  // TIL 섹션
  lines.push('\t- [[TIL]]');

  // Tasks 섹션
  lines.push('- [[Tasks]]');
  lines.push('\t- TODO ');

  // 수면 섹션
  lines.push('- [[수면]]');
  lines.push('\t- 취침:');
  lines.push('\t- 기상:');
  lines.push('\t- 질: /5');

  return lines.join('\n');
}

/**
 * 기존 저널에 템플릿이 있는지 확인
 */
function hasTemplate(content) {
  return content.includes('[[일기]]') || content.includes('[[날씨]]');
}

/**
 * 메인 함수
 */
async function addTodayDairy() {
  const today = getKSTDate();
  const filename = formatDateForFilename(today);
  const filePath = join(JOURNALS_PATH, filename);

  console.log(`[${new Date().toISOString()}] Logseq Daily Note 자동 생성 시작`);
  console.log(`대상 파일: ${filePath}`);

  try {
    // journals 폴더 확인
    if (!existsSync(JOURNALS_PATH)) {
      await mkdir(JOURNALS_PATH, { recursive: true });
      console.log(`journals 폴더 생성: ${JOURNALS_PATH}`);
    }

    // 기존 파일 내용 확인
    let existingContent = '';
    if (existsSync(filePath)) {
      existingContent = await readFile(filePath, 'utf-8');

      // 이미 템플릿이 있으면 건너뜀
      if (hasTemplate(existingContent)) {
        console.log('이미 일기 템플릿이 존재합니다. 건너뜁니다.');
        return { success: true, message: '이미 템플릿 존재' };
      }
    }

    // 날씨 정보 가져오기 (3회 재시도)
    let weatherLines = null;
    const weatherScraper = new WeatherScraper();

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`날씨 정보 가져오기 시도 ${attempt}/3...`);
        const weather = await weatherScraper.getWeatherForDongcheon();
        if (weather) {
          weatherLines = weatherScraper.formatWeatherForLogseq(weather);
          console.log('날씨 정보 수집 성공');
          break;
        }
      } catch (error) {
        console.error(`날씨 수집 실패 (시도 ${attempt}):`, error.message);
        if (attempt < 3) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }
    }

    // 템플릿 생성
    const template = await generateTemplate(weatherLines);

    // 파일 작성
    const newContent = existingContent
      ? existingContent + '\n' + template
      : template;

    await writeFile(filePath, newContent, 'utf-8');
    console.log('Daily Note 템플릿 생성 완료!');
    console.log(`파일: ${filePath}`);

    return { success: true, message: '템플릿 생성 완료' };

  } catch (error) {
    console.error('오류 발생:', error.message);
    return { success: false, message: error.message };
  }
}

// 실행
addTodayDairy()
  .then(result => {
    console.log('결과:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('치명적 오류:', error);
    process.exit(1);
  });
