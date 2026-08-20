/**
 * 리트리버 계약 테스트
 *
 * Dev-A 파이프라인이 의존하는 보장사항을 검증합니다.
 *  - 저장소가 비어 있어도 throw하지 않는다
 *  - 확정 번역은 key 정확 조회로 반환된다
 *  - 금지 패턴이 프롬프트 블록에 포함된다
 *  - 벡터 검색이 불가능해도 결정론적 채널은 동작한다
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initRetriever,
  retrieveForBatch,
  retrieverStatus,
  type RetrievalEntry,
} from './retriever.js';
import { _resetRetriever } from './retriever.js';
import {
  saveConfirmed,
  saveRejected,
  loadConfirmed,
  loadRejected,
  makeId,
  FEEDBACK_PATHS,
  type ConfirmedEntry,
  type RejectedEntry,
} from './feedback-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// 테스트가 실제 피드백 파일을 훼손하지 않도록 백업/복원
let backup: { confirmed?: string; rejected?: string } = {};

function backupFiles() {
  backup = {};
  if (fs.existsSync(FEEDBACK_PATHS.confirmed)) {
    backup.confirmed = fs.readFileSync(FEEDBACK_PATHS.confirmed, 'utf-8');
  }
  if (fs.existsSync(FEEDBACK_PATHS.rejected)) {
    backup.rejected = fs.readFileSync(FEEDBACK_PATHS.rejected, 'utf-8');
  }
}

function restoreFiles() {
  if (backup.confirmed !== undefined) {
    fs.writeFileSync(FEEDBACK_PATHS.confirmed, backup.confirmed, 'utf-8');
  } else if (fs.existsSync(FEEDBACK_PATHS.confirmed)) {
    fs.unlinkSync(FEEDBACK_PATHS.confirmed);
  }
  if (backup.rejected !== undefined) {
    fs.writeFileSync(FEEDBACK_PATHS.rejected, backup.rejected, 'utf-8');
  } else if (fs.existsSync(FEEDBACK_PATHS.rejected)) {
    fs.unlinkSync(FEEDBACK_PATHS.rejected);
  }
}

const SAMPLE_ENTRIES: RetrievalEntry[] = [
  {
    key: 'console.setting.group.title.workspacegroup_settings',
    source: 'Workspace/Group Settings',
    context: 'Settings header',
    role: 'title',
  },
  {
    key: 'console.setting.group.label.art_lounge',
    source: 'Art Lounge',
    context: 'Service list',
    role: 'label',
  },
];

describe('retriever', () => {
  beforeEach(() => {
    backupFiles();
    _resetRetriever();
  });

  afterEach(() => {
    restoreFiles();
    _resetRetriever();
  });

  it('저장소가 비어 있어도 throw하지 않는다', async () => {
    saveConfirmed({});
    saveRejected({});
    // 벡터 검색을 끄면 모델 다운로드 없이 빠르게 검증 가능
    await initRetriever({ disableVectorSearch: true });

    const ctx = await retrieveForBatch(SAMPLE_ENTRIES);
    expect(ctx).toBeDefined();
    expect(Object.keys(ctx.confirmed)).toHaveLength(0);
    expect(ctx.forbidden).toHaveLength(0);
    expect(ctx.stats.entries).toBe(2);
  });

  it('빈 입력에도 안전하다', async () => {
    await initRetriever({ disableVectorSearch: true });
    const ctx = await retrieveForBatch([]);
    expect(ctx.promptBlock).toBe('');
    expect(ctx.stats.entries).toBe(0);
  });

  it('용어집 규칙을 복합어 내부에서도 찾는다', async () => {
    saveConfirmed({});
    saveRejected({});
    await initRetriever({ disableVectorSearch: true });

    const ctx = await retrieveForBatch(SAMPLE_ENTRIES);
    const terms = ctx.glossaryTerms.map((g) => g.term);

    // "Workspace/Group Settings" 안의 Workspace 가 잡혀야 한다 (glossary §8-2)
    expect(terms).toContain('Workspace');
    const ws = ctx.glossaryTerms.find((g) => g.term === 'Workspace');
    expect(ws?.ko).toBe('워크스페이스');
    expect(ctx.promptBlock).toContain('GLOSSARY');
    expect(ctx.promptBlock).toContain('워크스페이스');
  });

  it('확정 번역을 key 정확 조회로 반환한다', async () => {
    const key = SAMPLE_ENTRIES[0].key;
    const entry: ConfirmedEntry = {
      key,
      locale: 'ko',
      sourceText: 'Workspace/Group Settings',
      translation: '워크스페이스/그룹 설정',
      confirmedAtRound: 1,
      verifiedBy: ['layer1', 'layer2'],
    };
    saveConfirmed({ [makeId(key, 'ko')]: entry });
    saveRejected({});

    await initRetriever({ disableVectorSearch: true });
    const ctx = await retrieveForBatch(SAMPLE_ENTRIES);

    expect(ctx.confirmed[key]?.ko).toBe('워크스페이스/그룹 설정');
    // 확정되지 않은 항목은 포함되지 않는다
    expect(ctx.confirmed[SAMPLE_ENTRIES[1].key]).toBeUndefined();
    expect(ctx.promptBlock).toContain('ALREADY APPROVED');
  });

  it('거부 이력을 금지 패턴으로 노출한다', async () => {
    const key = SAMPLE_ENTRIES[1].key;
    const rejected: RejectedEntry = {
      key,
      locale: 'ko',
      wrong: '아트 라운지',
      reason: '제품명 번역 금지 (glossary §7)',
      layer: 2,
      round: 1,
      correct: 'Art Lounge',
    };
    saveConfirmed({});
    saveRejected({ [makeId(key, 'ko')]: [rejected] });

    await initRetriever({ disableVectorSearch: true });
    const ctx = await retrieveForBatch(SAMPLE_ENTRIES);

    expect(ctx.forbidden.length).toBeGreaterThan(0);
    const hit = ctx.forbidden.find((f) => f.wrong === '아트 라운지');
    expect(hit).toBeDefined();
    expect(hit?.correct).toBe('Art Lounge');
    expect(ctx.promptBlock).toContain('PREVIOUSLY REJECTED');
    expect(ctx.promptBlock).toContain('아트 라운지');
  });

  it('부분문자열 오탐을 걸러낸다 (Workspace 안의 Space)', async () => {
    saveConfirmed({});
    saveRejected({});
    await initRetriever({ disableVectorSearch: true });

    const ctx = await retrieveForBatch([
      {
        key: 'k1',
        source: 'Workspace/Group Settings',
        role: 'title',
      },
    ]);
    const terms = ctx.glossaryTerms.map((g) => g.term);

    expect(terms).toContain('Workspace');
    expect(terms).toContain('Group');
    // "Workspace" 안의 "space"가 Space 용어로 잡히면 "워크공간"이 나올 수 있다
    expect(terms).not.toContain('Space');
    expect(ctx.promptBlock).not.toContain('"Space"');
  });

  it('단어 단위로 등장하는 용어는 정상 검출한다', async () => {
    saveConfirmed({});
    saveRejected({});
    await initRetriever({ disableVectorSearch: true });

    const ctx = await retrieveForBatch([{ key: 'k2', source: 'Space', role: 'label' }]);
    expect(ctx.glossaryTerms.map((g) => g.term)).toContain('Space');
  });

  it('벡터 검색을 끄면 degraded로 표시하되 결정론적 채널은 동작한다', async () => {
    saveConfirmed({});
    saveRejected({});
    await initRetriever({ disableVectorSearch: true });

    const ctx = await retrieveForBatch(SAMPLE_ENTRIES);
    expect(ctx.stats.degraded).toBe(true);
    expect(ctx.similar).toHaveLength(0);
    // 용어집은 여전히 동작
    expect(ctx.glossaryTerms.length).toBeGreaterThan(0);
  });

  it('initRetriever 없이 호출해도 자동 초기화된다', async () => {
    saveConfirmed({});
    saveRejected({});
    _resetRetriever();
    expect(retrieverStatus().initialized).toBe(false);

    const ctx = await retrieveForBatch([SAMPLE_ENTRIES[0]]);
    expect(ctx).toBeDefined();
    expect(retrieverStatus().initialized).toBe(true);
  });
});

describe('feedback-store', () => {
  beforeEach(backupFiles);
  afterEach(restoreFiles);

  it('저장한 확정 번역을 다시 읽는다', () => {
    const id = makeId('a.b.c', 'ko');
    saveConfirmed({
      [id]: {
        key: 'a.b.c',
        locale: 'ko',
        sourceText: 'Save',
        translation: '저장',
        confirmedAtRound: 2,
        verifiedBy: ['layer1'],
      },
    });
    const loaded = loadConfirmed();
    expect(loaded[id]?.translation).toBe('저장');
    expect(loaded[id]?.confirmedAtRound).toBe(2);
  });

  it('같은 항목의 거부 이력을 여러 건 보관한다', () => {
    const id = makeId('a.b.c', 'ja');
    saveRejected({
      [id]: [
        { key: 'a.b.c', locale: 'ja', wrong: 'X', reason: 'r1', layer: 2, round: 1 },
        { key: 'a.b.c', locale: 'ja', wrong: 'Y', reason: 'r2', layer: 3, round: 2 },
      ],
    });
    expect(loadRejected()[id]).toHaveLength(2);
  });

  it('파일이 없으면 빈 값을 반환한다', () => {
    if (fs.existsSync(FEEDBACK_PATHS.confirmed)) fs.unlinkSync(FEEDBACK_PATHS.confirmed);
    expect(loadConfirmed()).toEqual({});
  });
});
