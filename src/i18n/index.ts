import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import de from './locales/de.json'
import es from './locales/es.json'

/**
 * LUMEN i18n — German default with Spanish support for field technicians.
 *
 * Convention: UI chrome (buttons, labels, nav, dialogs) is translated.
 * Domain terms (Rückmeldung, Tiefbau, HÜP, NE3/NE4) stay in German even
 * in Spanish UI — these are the vocabulary technicians use daily with
 * clients, operators and paperwork. Translating them would break the
 * 1:1 match with the real workflow.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      es: { translation: es },
    },
    fallbackLng: 'de',
    supportedLngs: ['de', 'es'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lumen-lang',
    },
  })

export default i18n
