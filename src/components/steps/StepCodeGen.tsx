import { useState } from 'react';

interface StepCodeGenProps {
  onNext: () => void;
  onBack: () => void;
}

const generatedFiles = [
  { path: 'src/locales/en.json', size: '2.8 KB', keys: 87 },
  { path: 'src/locales/ko.json', size: '3.1 KB', keys: 87 },
  { path: 'src/locales/ja.json', size: '3.2 KB', keys: 87 },
  { path: 'src/locales/zh-CN.json', size: '2.9 KB', keys: 87 },
  { path: 'src/components/ConsoleSettingGroup.tsx', size: '8.4 KB', keys: 72 },
  { path: 'src/components/DocTitle.tsx', size: '0.9 KB', keys: 3 },
  { path: 'src/components/SidebarNav.tsx', size: '2.1 KB', keys: 20 },
  { path: 'src/i18n.ts', size: '0.5 KB', keys: 0 },
];

const codePreview = `import { useTranslation } from 'react-i18next';

/**
 * Auto-generated from components-map.json
 * Frame: Console_Setting_Group@User
 */
function ConsoleSettingGroup() {
  const { t } = useTranslation();

  return (
    <div className="console-setting-group">
      <h1>{t('signage.setting.group.title.console')}</h1>
      
      <section>
        <h2>{t('signage.setting.group.title.workspacegroup_settings')}</h2>
        <div className="form-field">
          <label>{t('signage.setting.group.label.business_site_id')}</label>
          <input placeholder={t('signage.setting.group.placeholder.lg_electronics')} />
        </div>
        <button>{t('signage.setting.group.button.save')}</button>
        <button>{t('signage.setting.group.button.publish')}</button>
      </section>
    </div>
  );
}`;

function StepCodeGen({ onNext, onBack }: StepCodeGenProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'code' | 'json'>('files');

  const jsonPreview = `{
  "signage": {
    "setting": {
      "group": {
        "title": {
          "console": "Console",
          "workspacegroup_settings": "Workspace/Group Settings",
          "business_site_name": "Business Site Name"
        },
        "label": {
          "content": "Content",
          "schedule": "Schedule",
          "device": "Device",
          "settings": "Settings"
        },
        "button": {
          "publish": "Publish",
          "save": "Save",
          "edit": "Edit",
          "delete": "Delete"
        }
      }
    }
  }
}`;

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>⚡ Step 4. 코드 생성 완료</h2>
        <p className="step-description">
          components-map.json을 기반으로 React 컴포넌트와 i18n 파일을 생성했습니다.<br />
          모든 텍스트가 <code>t('key')</code>로 바인딩되어 즉시 사용 가능합니다.
        </p>
      </div>

      {/* Generated Stats */}
      <div className="codegen-stats">
        <div className="codegen-stat">
          <span className="stat-number">8</span>
          <span className="stat-label">생성된 파일</span>
        </div>
        <div className="codegen-stat">
          <span className="stat-number">87</span>
          <span className="stat-label">i18n Keys</span>
        </div>
        <div className="codegen-stat">
          <span className="stat-number">3</span>
          <span className="stat-label">React 컴포넌트</span>
        </div>
        <div className="codegen-stat">
          <span className="stat-number">4</span>
          <span className="stat-label">Locale 파일</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="code-tabs">
        <button
          className={`code-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📁 생성된 파일
        </button>
        <button
          className={`code-tab ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          📝 컴포넌트 코드
        </button>
        <button
          className={`code-tab ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          🗂️ Locale JSON
        </button>
      </div>

      {/* Tab Content */}
      <div className="code-content">
        {activeTab === 'files' && (
          <div className="file-list">
            {generatedFiles.map((file) => (
              <div key={file.path} className="file-item">
                <span className="file-icon">
                  {file.path.endsWith('.json') ? '🗂️' : '⚛️'}
                </span>
                <span className="file-path">{file.path}</span>
                <span className="file-size">{file.size}</span>
                <span className="file-keys">
                  {file.keys > 0 && `${file.keys} keys`}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'code' && (
          <div className="code-preview">
            <div className="code-filename">src/components/ConsoleSettingGroup.tsx</div>
            <pre className="code-block">{codePreview}</pre>
            <p className="code-note">
              💡 모든 하드코딩된 텍스트가 <code>t('key')</code>로 치환되었습니다.
              언어를 바꾸면 UI가 자동으로 전환됩니다.
            </p>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="code-preview">
            <div className="code-filename">src/locales/en.json (일부)</div>
            <pre className="code-block">{jsonPreview}</pre>
            <p className="code-note">
              💡 계층적 구조: <code>signage.setting.group.{'{type}'}.{'{id}'}</code><br />
              동일한 key 구조가 ko.json, ja.json, zh-CN.json에도 적용됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={onBack}>← 이전</button>
        <button className="btn btn-primary btn-large" onClick={onNext}>
          🖥️ 최종 미리보기
        </button>
      </div>
    </div>
  );
}

export default StepCodeGen;
