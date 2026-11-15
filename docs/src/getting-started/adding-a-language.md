# Adding a Language

German and English are built in. A further language is one JSON file that you place in a directory. You need no build and no change to the source code, only a restart.

## 1. Create the file

1. Pick the language code. It must be a language that Payload knows, written in lower case without a region: `fr`, `nl`, `es`. The file name is the code plus `.json` (`fr.json`).
2. Copy `locales/en.json` from the repository to `fr.json`.
3. Set `meta.name` to the name shown to users (`"Français"`). `meta.dateLocale` is optional: it names the date format of the language (`fr-FR`). Without it the server derives the format from the code.
4. Translate the values in the block `site` (status page, emails, feeds). Keep the keys unchanged. Keep placeholders such as `{timezone}` or `{{siteName}}` exactly as they are, they are replaced when the text is shown.

## 2. Translate the admin panel (optional)

The block `admin` holds the texts of the admin panel. The key is the English text, the value is the translation. `en.json` leaves the block empty, because English is the key. The template is `locales/de.json`: copy its block `admin` into your file and replace the German values. Keys can end in a suffix such as `|role`. The suffix separates identical English texts with different meaning, do not change it.

The admin panel's own buttons and menus come from Payload. If Payload has no translation for your language code, they stay English.

## 3. Check the file

```bash
npm run check:locales ./my-locales
```

The command reports missing or surplus keys as warnings, and invalid JSON, wrong file names and placeholders that differ from the English text as errors. Without a directory it checks the files in `locales/`.

## 4. Place the file and restart

Put the file in a directory of your choice and point the server to it:

| Variable | Value |
|----------|-------|
| `LOCALES_DIR` | Directory with your files |
| `DEFAULT_LANGUAGE` | The language code, for example `fr` |

With Docker, mount the directory as a volume (`./locales:/app/locales:ro`, `LOCALES_DIR=/app/locales`). With Helm, use `locales.files` (see [Helm](./helm.md#interface-language)). Then restart the application.

## 5. Check the result

- The log names problems with a line starting with `[i18n]` (invalid file, unknown language code, `DEFAULT_LANGUAGE` that was not loaded). No such line means the file was read.
- The status page, the emails, the feeds and the admin panel show the new language.
- A text missing in your file is shown in English. Add it and restart.

## Notes

- All visitors and all admin users see the same language. It cannot be changed in the admin panel, only through `DEFAULT_LANGUAGE`.
- The date and time format is the setting **Locale** (Site Settings → Localization). Empty, it follows the language.
