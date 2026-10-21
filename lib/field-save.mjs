// Saves a named form field when it changes. Wired once per sheet: the listener sits on the window root, which survives
// the re-renders that follow every save.

export function wireFieldSave(sheet, save) {
  const root = sheet.element;
  if (!root || sheet._fieldSaveWired) return;
  sheet._fieldSaveWired = true;

  root.addEventListener('change', (event) => {
    const field = event.target;
    if (!field?.name || !field.isConnected) return;
    if (sheet.isEditable === false) return;

    const value = field.type === 'checkbox' ? field.checked
      : field.type === 'number' ? (Number(field.value) || 0)
      : field.value;
    save(field.name, value);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target?.tagName === 'INPUT') {
      event.target.blur();
    }
  });
}
