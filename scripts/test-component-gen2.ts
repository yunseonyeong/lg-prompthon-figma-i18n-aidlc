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

async function generateComponent() {
  const prompt = `You are a senior React developer. Generate a complete React functional component for a Settings page.

COMPONENT NAME: ConsoleSettingGroupUser

The component should include:
1. Workspace/Group Settings section with title and form fields
2. Business Site Information section  
3. License Management section with Assign/Withdraw/Extend buttons
4. User/Device count table

Use these i18n keys (examples):
- t('console.setting.group.title.workspaceGroupSettings') // "Workspace/Group Settings"
- t('console.setting.group.label.businessSiteInformation') // "Business Site Information"
- t('console.setting.group.button.publish') // "Publish"
- t('console.setting.group.button.save') // "Save"
- t('console.setting.group.button.withdraw') // "Withdraw" (라이선스 회수)
- t('console.setting.group.button.extend') // "Extend" (기간 연장)
- t('console.setting.group.label.workspaceName') // "Workspace Name"
- t('console.setting.group.label.deviceCount') // "Device Count"
- t('console.setting.group.label.userCount') // "User Count"

REQUIREMENTS:
1. Use React Bootstrap (Card, Button, Form, Table, Row, Col, Badge)
2. Use react-i18next useTranslation hook
3. ALL visible text must use t('key')
4. Export as default
5. Make it a COMPLETE, working component

RESPOND ONLY WITH CODE:`;

  console.log('🤖 EXAONE에 요청 중...');

  const response = await fetch(CONFIG.friendliApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.friendliApiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.friendliModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    console.error('API 오류:', response.status);
    return;
  }

  const data = await response.json();
  let code = data.choices?.[0]?.message?.content || '';
  code = code.replace(/^```(?:tsx|typescript|jsx|javascript)?\n?/gm, '').replace(/```$/gm, '').trim();

  const outputDir = path.resolve(__dirname, '../src/components/generated');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'ConsoleSettingGroupUser.tsx');
  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(`✅ 저장됨: ${outputPath} (${code.length} chars)`);
  console.log('\n--- 코드 끝부분 확인 ---');
  console.log(code.slice(-300));
}

generateComponent().catch(console.error);
