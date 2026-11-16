// Wird vor allen Unit-Tests geladen (npm run test:unit, --import). Viele Tests erwarten deutsche Texte, die Vorgabe
// der Anwendung ist Englisch. Eine von außen gesetzte Sprache bleibt bestehen.
process.env.DEFAULT_LANGUAGE ??= 'de'
