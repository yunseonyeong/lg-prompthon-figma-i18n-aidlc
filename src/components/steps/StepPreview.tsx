import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';

interface StepPreviewProps {
  onBack: () => void;
  onNext: () => void;
}

function StepPreview({ onBack, onNext }: StepPreviewProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>🖥️ Step 5. 최종 미리보기</h2>
        <p className="step-description">
          생성된 React 컴포넌트가 실제로 동작하는 모습입니다.<br />
          언어를 전환하면 모든 UI 텍스트가 실시간으로 변경됩니다.
        </p>
      </div>

      {/* Language Switcher (prominent) */}
      <div className="preview-lang-bar">
        <span className="preview-lang-label">🌐 언어 전환:</span>
        <LanguageSwitcher />
        <span className="preview-lang-current">현재: <strong>{i18n.language}</strong></span>
      </div>

      {/* Preview Frame */}
      <div className="preview-frame">
        <div className="preview-chrome">
          <div className="chrome-dots">
            <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
          </div>
          <span className="chrome-url">localhost:5173 — LG Signage Console</span>
        </div>

        <div className="preview-body">
          {/* Simulated Sidebar */}
          <aside className="preview-sidebar">
            <div className="preview-sidebar-title">{t('signage.setting.group.title.console')}</div>
            <nav className="preview-nav">
              <button className="preview-nav-item">{t('signage.setting.group.label.dashboard')}</button>
              <button className="preview-nav-item">{t('signage.setting.group.label.content')}</button>
              <button className="preview-nav-item">{t('signage.setting.group.label.schedule')}</button>
              <button className="preview-nav-item">{t('signage.setting.group.label.devices')}</button>
              <button className="preview-nav-item">{t('signage.setting.group.label.analytics')}</button>
              <button className="preview-nav-item active">{t('signage.setting.group.label.settings')}</button>
            </nav>
          </aside>

          {/* Simulated Main Content */}
          <div className="preview-main">
            <div className="preview-page-header">
              <h2>{t('signage.setting.group.title.workspacegroup_settings')}</h2>
              <div className="preview-actions">
                <button className="btn btn-secondary btn-sm">{t('signage.setting.group.button.edit')}</button>
                <button className="btn btn-primary btn-sm">{t('signage.setting.group.button.save')}</button>
                <button className="btn btn-primary btn-sm">{t('signage.setting.group.button.publish')}</button>
              </div>
            </div>

            {/* Business Site Info */}
            <section className="preview-section">
              <h3>{t('signage.setting.group.label.business_site_information')}</h3>
              <div className="preview-form">
                <div className="preview-field">
                  <label>{t('signage.setting.group.label.business_site_id')}</label>
                  <input type="text" placeholder={t('signage.setting.group.placeholder.lg_electronics')} readOnly />
                </div>
                <div className="preview-field">
                  <label>{t('signage.setting.group.label.region_country')}</label>
                  <select disabled>
                    <option>{t('signage.setting.group.label.asia_pacific')}</option>
                  </select>
                </div>
                <div className="preview-field">
                  <label>{t('signage.setting.group.label.time_zone')}</label>
                  <select disabled>
                    <option>{t('signage.setting.group.label.utc0900_asiaseoul')}</option>
                  </select>
                </div>
                <div className="preview-field">
                  <label>{t('signage.setting.group.label.business_type')}</label>
                  <select disabled>
                    <option>{t('signage.setting.group.label.end_customer')}</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Toggle Sections */}
            <section className="preview-section">
              <div className="preview-toggle-row">
                <span>{t('signage.setting.group.title.automatic_license_assignment')}</span>
                <span className="toggle-on">{t('signage.setting.group.label.on')}</span>
              </div>
              <div className="preview-toggle-row">
                <span>{t('signage.setting.group.title.automatic_device_approval')}</span>
                <span className="toggle-on">{t('signage.setting.group.label.on')}</span>
              </div>
              <div className="preview-toggle-row">
                <span>{t('signage.setting.group.title.single_signon_sso')}</span>
                <button className="btn btn-outline btn-sm">{t('signage.setting.group.button.turn_off')}</button>
              </div>
            </section>

            {/* Theme */}
            <section className="preview-section">
              <h3>{t('signage.setting.group.label.theme_color')}</h3>
              <div className="preview-themes">
                <div className="preview-theme active">
                  <div className="theme-swatch theme-basic" />
                  <span>{t('signage.setting.group.label.basic')}</span>
                </div>
                <div className="preview-theme">
                  <div className="theme-swatch theme-dark" />
                  <span>{t('signage.setting.group.label.dark')}</span>
                </div>
                <div className="preview-theme">
                  <div className="theme-swatch theme-03" />
                  <span>{t('signage.setting.group.label.thema_03')}</span>
                </div>
              </div>
            </section>

            {/* Workspace Table */}
            <section className="preview-section">
              <div className="preview-table-header">
                <button className="btn btn-primary btn-sm">{t('signage.setting.group.button.add_workspace')}</button>
                <input
                  type="text"
                  placeholder={t('signage.setting.group.label.search_for_workspace')}
                  className="preview-search"
                  readOnly
                />
              </div>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>{t('signage.setting.group.label.workspace_name')}</th>
                    <th>{t('signage.setting.group.label.device_count')}</th>
                    <th>{t('signage.setting.group.label.user_count')}</th>
                    <th>{t('signage.setting.group.label.licensed_product')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Workspace A1</td>
                    <td>12</td>
                    <td>5</td>
                    <td>Pro</td>
                  </tr>
                  <tr>
                    <td>Workspace B2</td>
                    <td>8</td>
                    <td>3</td>
                    <td>Standard</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="preview-summary">
        <h4>✨ 결과 요약</h4>
        <ul>
          <li>Figma 디자인에서 <strong>87개 텍스트</strong>를 자동 추출</li>
          <li>UX 문맥 기반으로 <strong>4개 언어</strong> 번역 완료</li>
          <li>React 컴포넌트 <strong>자동 생성</strong> — 바로 사용 가능</li>
          <li>전체 소요 시간: <strong>약 5분</strong> (기존 수작업 대비 96% 단축)</li>
        </ul>
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={onBack}>← 이전</button>
        <button className="btn btn-primary btn-large" onClick={onNext}>
          📝 QA 검증 가이드
        </button>
      </div>
    </div>
  );
}

export default StepPreview;
