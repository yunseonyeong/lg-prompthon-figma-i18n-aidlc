/**
 * EXAONE 컴포넌트 생성 테스트
 * components-map.json을 기반으로 React 컴포넌트 코드 생성
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.join(os.homedir(), '.hermes', '.env') });

const CONFIG = {
  friendliApiUrl: process.env.FRIENDLI_API_URL || 'https://api.friendli.ai/dedicated/v1/chat/completions',
  friendliApiKey: process.env.FRIENDLI_API_KEY || '',
  friendliModel: process.env.FRIENDLI_MODEL || 'depe675tjc2rcpo',
};

interface ComponentMapEntry {
  type: string;
  key: string;
  originalText: string;
}

interface ComponentMapFrame {
  frame: string;
  frameId: string;
  children: ComponentMapEntry[];
}

async function generateComponent(frame: ComponentMapFrame): Promise<string | null> {
  const componentName = toPascalCase(frame.frame);
  
  const keyTextPairs = frame.children.map((child) => ({
    key: child.key,
    text: child.originalText,
    type: child.type,
  }));

  const titles = keyTextPairs.filter((p) => p.type === 'title');
  const labels = keyTextPairs.filter((p) => p.type === 'label');
  const buttons = keyTextPairs.filter((p) => p.type === 'button');

  const prompt = `You are a senior React developer. Generate a React functional component based on the following Figma frame structure.

COMPONENT NAME: ${componentName}
FRAME: ${frame.frame}

UI ELEMENTS (with i18n keys):
${titles.length > 0 ? `\nTITLES:\n${titles.map((t) => `  - t('${t.key}') // "${t.text}"`).join('\n')}` : ''}
${labels.length > 0 ? `\nLABELS (first 10):\n${labels.slice(0, 10).map((t) => `  - t('${t.key}') // "${t.text}"`).join('\n')}` : ''}
${buttons.length > 0 ? `\nBUTTONS:\n${buttons.map((t) => `  - t('${t.key}') // "${t.text}"`).join('\n')}` : ''}

REQUIREMENTS:
1. Use React Bootstrap components (Card, Button, Form, Table, Row, Col, Badge)
2. Use react-i18next's useTranslation hook for ALL text
3. Every visible text MUST use t('key') - NO hardcoded strings
4. Create a clean, professional UI layout
5. Export the component as default

RESPOND ONLY WITH THE CODE. Start with import statements.`;

  console.log(`\n🤖 EXAONE에 요청 중: ${componentName}...`);

  try {
    const response = await fetch(CONFIG.friendliApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${CONFIG.friendliApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.friendliModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ API 오류: ${response.status} - ${error.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    let code = data.choices?.[0]?.message?.content || '';
    
    // 코드 블록 마커 제거
    code = code.replace(/^```(?:tsx|typescript|jsx|javascript)?\n?/gm, '').replace(/```$/gm, '').trim();

    console.log(`✅ ${componentName} 생성 완료 (${code.length} chars)`);
    return code;
  } catch (error) {
    console.error(`❌ 오류:`, error);
    return null;
  }
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

async function main() {
  console.log('🚀 EXAONE 컴포넌트 생성 테스트 시작\n');

  // components-map.json 로드
  const mapPath = path.resolve(__dirname, '../src/components-map.json');
  const componentsMap: ComponentMapFrame[] = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  
  console.log(`📁 ${componentsMap.length}개 프레임 발견`);

  // 출력 디렉토리 생성
  const outputDir = path.resolve(__dirname, '../src/components/generated');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 첫 번째 프레임만 테스트 (시간 절약)
  const frame = componentsMap[0];
  console.log(`\n🎯 테스트 대상: ${frame.frame}`);
  console.log(`   - titles: ${frame.children.filter(c => c.type === 'title').length}`);
  console.log(`   - labels: ${frame.children.filter(c => c.type === 'label').length}`);
  console.log(`   - buttons: ${frame.children.filter(c => c.type === 'button').length}`);

  const code = await generateComponent(frame);
  
  if (code) {
    const componentName = toPascalCase(frame.frame);
    const filePath = path.join(outputDir, `${componentName}.tsx`);
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log(`\n💾 저장됨: ${filePath}`);
    
    // 생성된 코드 미리보기
    console.log('\n--- 생성된 코드 (처음 50줄) ---');
    console.log(code.split('\n').slice(0, 50).join('\n'));
    console.log('...\n');
  }

  console.log('✅ 테스트 완료!');
}

main().catch(console.error);
