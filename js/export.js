/**
 * FinanzApp — Export / Import utilities
 */
const Export = {

  /* ── CSV ──────────────────────────────────────────────── */

  toCSV(transactions, currency = '$') {
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Moneda'];
    const rows = transactions
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(t => [
        t.date,
        t.type === 'income' ? 'Ingreso' : 'Gasto',
        t.category,
        t.description || '',
        t.amount.toFixed(2),
        currency,
      ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    this._download(
      `finanzapp_${this._dateTag()}.csv`,
      '\uFEFF' + csv,          // BOM for Excel UTF-8 detection
      'text/csv;charset=utf-8;'
    );
  },

  /* ── Excel (SpreadsheetML / XML format) ───────────────── */

  toExcel(transactions, currency = '$') {
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Moneda'];
    const rows = transactions
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(t => [
        t.date,
        t.type === 'income' ? 'Ingreso' : 'Gasto',
        t.category,
        t.description || '',
        t.amount.toFixed(2),
        currency,
      ]);

    const esc = s => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const headerRow = headers.map(h => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
    const dataRows  = rows.map(row =>
      '<Row>' + row.map((cell, ci) => {
        const type = ci === 4 ? 'Number' : 'String';
        return `<Cell><Data ss:Type="${type}">${esc(cell)}</Data></Cell>`;
      }).join('') + '</Row>'
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="h">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#7c3aed" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="FinanzApp">
    <Table>
      <Row>${headerRow}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

    this._download(
      `finanzapp_${this._dateTag()}.xls`,
      xml,
      'application/vnd.ms-excel;charset=utf-8;'
    );
  },

  /* ── JSON Backup ──────────────────────────────────────── */

  toJSON(data) {
    const backup = {
      version:    '1.0.0',
      app:        'FinanzApp',
      exportedAt: new Date().toISOString(),
      ...data,
    };
    // Don't export PIN for privacy
    if (backup.settings) delete backup.settings.pin;

    this._download(
      `finanzapp_backup_${this._dateTag()}.json`,
      JSON.stringify(backup, null, 2),
      'application/json'
    );
  },

  /* ── JSON Import ──────────────────────────────────────── */

  fromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          // Basic validation
          if (!parsed.transactions && !parsed.categories) {
            reject(new Error('El archivo no tiene datos válidos de FinanzApp'));
            return;
          }
          resolve(parsed);
        } catch {
          reject(new Error('Archivo JSON inválido o corrupto'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  },

  /* ── Internal ─────────────────────────────────────────── */

  _dateTag() {
    return new Date().toISOString().slice(0, 10);
  },

  _download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
