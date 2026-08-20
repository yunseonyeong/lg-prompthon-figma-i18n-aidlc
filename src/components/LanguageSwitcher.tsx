import { useTranslation } from 'react-i18next';
import { ButtonGroup, Button } from 'react-bootstrap';

const langs = [
  { code: 'en', label: '🇺🇸' },
  { code: 'ko', label: '🇰🇷' },
  { code: 'ja', label: '🇯🇵' },
  { code: 'zh-CN', label: '🇨🇳' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <ButtonGroup size="sm">
      {langs.map((lang) => (
        <Button
          key={lang.code}
          variant={i18n.language === lang.code ? 'primary' : 'outline-secondary'}
          onClick={() => i18n.changeLanguage(lang.code)}
        >
          {lang.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}

export default LanguageSwitcher;
