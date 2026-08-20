/**
 * 리트리버 동작 확인 (npm run retriever:demo)
 *
 * Dev-A 파이프라인에서의 사용법을 그대로 재현합니다.
 * 실제 인덱스/저장소를 사용하므로 통합 확인용으로 씁니다.
 */
import { initRetriever, retrieveForBatch, retrieverStatus, type RetrievalEntry } from '../src/retrieval/index.js';

const BATCH: RetrievalEntry[] = [
  {
    key: 'console.setting.group.title.workspacegroup_settings',
    source: 'Workspace/Group Settings',
    context: 'Settings page header',
    role: 'title',
  },
  {
    key: 'console.setting.group.label.art_lounge',
    source: 'Art Lounge',
    context: 'Add-on service list',
    role: 'label',
  },
  {
    key: 'console.setting.group.button.remove_item',
    source: 'Remove item',
    context: 'List row action',
    role: 'button',
  },
  {
    key: 'console.setting.group.label.industry_field',
    source: 'Industry category',
    context: 'Business site registration',
    role: 'label',
  },
];

async function main() {
  console.log('⏳ 리트리버 초기화...\n');
  await initRetriever();

  const st = retrieverStatus();
  console.log('▶ 상태');
  console.log(`   용어집        : ${st.glossaryTerms}개`);
  console.log(`   확정 번역     : ${st.confirmed}건`);
  console.log(`   거부 이력     : ${st.rejected}건`);
  console.log(`   벡터 검색     : ${st.vectorReady ? '활성' : '비활성'}`);
  if (st.notes.length) st.notes.forEach((n) => console.log(`   ⚠️  ${n}`));

  const t0 = Date.now();
  const ctx = await retrieveForBatch(BATCH);
  const ms = Date.now() - t0;

  console.log(`\n▶ 검색 결과 (${BATCH.length}건 배치, ${ms}ms)`);
  console.log(`   확정 번역   : ${ctx.stats.confirmedCount}건`);
  console.log(`   용어집 규칙 : ${ctx.stats.glossaryCount}건`);
  console.log(`   금지 패턴   : ${ctx.stats.forbiddenCount}건`);
  console.log(`   유사 사례   : ${ctx.stats.similarCount}건`);
  console.log(`   degraded    : ${ctx.stats.degraded}`);

  if (ctx.similar.length > 0) {
    console.log('\n▶ 유사 사례 상세');
    ctx.similar.forEach((s) =>
      console.log(`   ${s.score.toFixed(4)}  "${s.sourceText}" → ${s.locale}: "${s.translation}"`)
    );
  }

  console.log('\n' + '═'.repeat(80));
  console.log('  promptBlock (EXAONE 프롬프트에 삽입되는 내용)');
  console.log('═'.repeat(80));
  console.log(ctx.promptBlock || '(비어 있음)');
  console.log('═'.repeat(80));
  console.log(`\n프롬프트 블록 크기: ${ctx.promptBlock.length}자\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
