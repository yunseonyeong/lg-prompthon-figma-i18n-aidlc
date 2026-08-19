# Domain Glossary (LG Business Cloud Console)

이 용어집은 DLC 플로우에서 번역 시 반드시 참조해야 하는 도메인 용어를 정의합니다.

**대상 도메인**: LG Business Cloud 콘솔 설정 (`Consol_Settings`)
**근거**: Figma `zdG3CHXVU6TzD4cc28o5Yb` / Scenario 페이지 UI 텍스트 7,830건 빈도 분석

> 이전 버전은 Signage 재생 장치 도메인(Player, Playlist, Channel 등)을 기준으로
> 작성되어 실제 대상 파일과 적중률이 4/12에 불과했습니다. 도메인을 교체했습니다.

---

## 1. 핵심 엔티티 (계층 구조)

권한과 리소스가 `Business Site > Workspace > Group > Device` 계층으로 구성됩니다.

| English | Context | ko | ja | zh-CN |
|---------|---------|-----|-----|-------|
| Business Site | 최상위 고객사 단위 | 비즈니스 사이트 | ビジネスサイト | 业务站点 |
| Workspace | Business Site 하위 작업 단위 | 워크스페이스 | ワークスペース | 工作区 |
| Group | 장치/사용자 묶음 | 그룹 | グループ | 组 |
| Device | 관리 대상 장치 | 장치 | デバイス | 设备 |
| User | 콘솔 사용자 | 사용자 | ユーザー | 用户 |
| Console | 관리 콘솔 | 콘솔 | コンソール | 控制台 |

## 2. 권한 / 역할

| English | Context | ko | ja | zh-CN |
|---------|---------|-----|-----|-------|
| Role | 권한 역할 | 역할 | ロール | 角色 |
| Access Group | 접근 권한 그룹 | 액세스 그룹 | アクセスグループ | 访问组 |
| Preset Role | 사전 정의된 역할 | 사전 정의 역할 | プリセットロール | 预设角色 |
| Custom Role | 사용자 정의 역할 | 사용자 지정 역할 | カスタムロール | 自定义角色 |
| Global Role | 전체 사이트 공통 역할 | 전역 역할 | グローバルロール | 全局角色 |
| Permission | 권한 | 권한 | 権限 | 权限 |

## 3. 라이선스 (오역 주의 구간)

라이선스를 워크스페이스에 **할당(Assign)** 하고 **회수(Withdraw)** 하며 **연장(Extend)** 합니다.

| English | Context | ko | ja | zh-CN |
|---------|---------|-----|-----|-------|
| License | 제품 라이선스 | 라이선스 | ライセンス | 许可证 |
| License Policy | 라이선스 정책 | 라이선스 정책 | ライセンスポリシー | 许可证策略 |
| Assign | 라이선스를 워크스페이스에 할당 | 할당 | 割り当て | 分配 |
| Withdraw | 할당한 라이선스를 **회수** (계정 탈퇴 아님) | 회수 | 回収 | 回收 |
| Extend | 라이선스 유효기간 **연장** (화면 확장 아님) | 연장 | 延長 | 延长 |
| Common Pool | 공용 라이선스 풀 | 공용 풀 | 共通プール | 公共池 |
| Assignable Days | 할당 가능 일수 | 할당 가능 일수 | 割り当て可能日数 | 可分配天数 |
| Valid Period | 유효 기간 | 유효 기간 | 有効期間 | 有效期 |
| Licensed Product | 라이선스가 부여된 제품 | 라이선스 제품 | ライセンス製品 | 许可产品 |

## 4. 인증 / 보안

| English | Context | ko | ja | zh-CN |
|---------|---------|-----|-----|-------|
| Single Sign-On | 통합 인증 | 싱글 사인온 | シングルサインオン | 单点登录 |
| Authentication Type | 인증 방식 | 인증 유형 | 認証タイプ | 认证类型 |
| API Key | API 인증 키 | API 키 | APIキー | API 密钥 |
| API Access | API 접근 권한 | API 액세스 | APIアクセス | API 访问 |
| Access Token | 액세스 토큰 | 액세스 토큰 | アクセストークン | 访问令牌 |
| Client Secret | 클라이언트 시크릿 | 클라이언트 시크릿 | クライアントシークレット | 客户端密钥 |

## 5. 비즈니스 분류 (오역 주의 구간)

Business Site 등록 정보에 쓰이는 B2B 분류 항목입니다.

| English | Context | ko | ja | zh-CN |
|---------|---------|-----|-----|-------|
| Vertical Type | **업종/산업 분야** 분류 (화면 방향 아님) | 산업 분야 | 業種 | 行业类型 |
| Business Type | 사업 유형 | 비즈니스 유형 | ビジネスタイプ | 业务类型 |
| System Integrator | SI 사업자 | 시스템 통합업체 | システムインテグレーター | 系统集成商 |
| End Customer | 최종 고객사 | 최종 고객 | エンドカスタマー | 最终客户 |
| Subsidiary | 법인/자회사 | 자회사 | 子会社 | 子公司 |

## 6. 메뉴 / 기능

| English | Context | ko | ja | zh-CN |
|---------|---------|-----|-----|-------|
| Dashboard | 대시보드 메뉴 | 대시보드 | ダッシュボード | 仪表板 |
| Space | 공간 관리 메뉴 | 공간 | スペース | 空间 |
| Content | 재생 콘텐츠 | 콘텐츠 | コンテンツ | 内容 |
| Schedule | 재생/제어 스케줄 | 스케줄 | スケジュール | 日程 |
| Content Schedule | 콘텐츠 재생 스케줄 | 콘텐츠 스케줄 | コンテンツスケジュール | 内容日程 |
| Control Schedule | 장치 제어 스케줄 | 제어 스케줄 | 制御スケジュール | 控制日程 |
| Group Control | 그룹 단위 제어 | 그룹 제어 | グループ制御 | 组控制 |
| Site Map | 사이트 배치도 | 사이트 맵 | サイトマップ | 站点地图 |
| Floor Plan | 층별 평면도 | 평면도 | フロアプラン | 平面图 |
| Saved Locations | 저장된 위치 | 저장된 위치 | 保存された場所 | 已保存位置 |
| Add-On Service | 부가 서비스 | 애드온 서비스 | アドオンサービス | 附加服务 |
| Analytics | 분석 | 분석 | アナリティクス | 分析 |
| Publish | 콘텐츠 배포 | 배포 | 配信 | 发布 |
| Signage | 디지털 사이니지 | 사이니지 | サイネージ | 数字标牌 |
| Videowall | 비디오월 | 비디오월 | ビデオウォール | 视频墙 |
| Tag | 분류 태그 | 태그 | タグ | 标签 |

---

## 7. 제품명 (번역 금지)

아래는 제품/서비스 고유명이므로 **원문을 그대로 유지**합니다.

`Art Lounge`, `Hotel Mobile App`, `CreateBoard Lab`, `Enterprise Content`, `Content Pro`,
`LG Electronics`, `LGEBN`, `Business Cloud`

---

## 8. 용어 적용 규칙

1. 이 테이블에 등록된 용어는 **반드시** 이 번역을 사용한다.
2. **복합어 내부에도 적용한다.** `Workspace/Group Settings` → `워크스페이스/그룹 설정`
   (`작업 공간/그룹 설정` 은 위반)
3. 동일 영어 단어가 다른 문맥에서 쓰일 경우 Context 열을 기준으로 판단한다.
4. 테이블에 없는 용어는 UX 흐름의 문맥을 분석하여 번역하고, 추가를 제안한다.
5. 약어(SSO, API, SAML, OAuth, SI)는 풀어서 번역하지 않고 그대로 사용한다.
6. **ON/OFF 표기**: 상태 표시는 `켜짐/꺼짐`, 동작(버튼)은 `켜기/끄기` 로 구분한다.
   같은 화면에서 `켜짐`과 `끔`이 섞이면 위반이다.
7. 단수/복수는 한국어에서 구분하지 않는다. `Device`/`Devices` 모두 `장치`.

---

## 9. 번역 제외 대상

용어집 적용 이전에 **번역 대상에서 제외**해야 하는 항목입니다.
발견 시 Dev-A 추출 필터로 반송합니다 (검증 명세 Layer 4).

| 유형 | 예시 |
|------|------|
| 시나리오 설명 테이블 | No / Classification / Description 3열 테이블 전체 |
| 더미 텍스트 | `Text Text`, `Description Description`, `supporting text`, `Label`, `Button`, `Title Title` |
| 샘플 데이터 | `Business A`, `Workspace A1`, `Device N`, `User N`, `workspace 1-1-1` |
| 샘플 주소 | `MagokJungang 10-ro, Gangseo-gu, Seoul`, `30, A101 bldg.` |
| 샘플 파일명 | `FileName_sample_00123.jpg` |
| 문서 내부 표기 | `Spec Out`, `Deleted`, `Modified` (시나리오 상태 주석) |
| 코드/포맷 값 | `LGEBN`, `YYYY.MM.DD`, `N.N.N`, `1 / 100` |

---

## 10. 용어 추가 요청

새 용어 제안 시 아래 항목을 채워 Dev-B에게 요청합니다.
(파서가 실제 용어로 오인하지 않도록 표 형식을 쓰지 않습니다)

- **English**: 원문
- **Context**: 어느 화면/기능에서 쓰이는지, 오역 위험이 있으면 그 이유
- **ko / ja / zh-CN**: 제안 번역
- **근거**: 같은 프레임의 주변 텍스트 목록

Dev-A가 생성하는 `glossary-proposal.md`가 1차 후보 목록입니다.
