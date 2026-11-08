'use strict';

function createDocumentPdfService({ dialog, windowFactory, fs }) {
  if (!dialog?.showSaveDialog || typeof windowFactory !== 'function' || !fs?.writeFile) {
    throw new Error('Dependências do serviço de exportação PDF incompletas.');
  }

  return Object.freeze({
    async exportIssuedPdf({ document, html, filename }) {
      if (!document || document.status !== 'issued') {
        throw new Error('A exportação PDF exige um documento emitido.');
      }
      if (typeof html !== 'string' || !html.trim()) {
        throw new Error('HTML do documento obrigatório para exportação PDF.');
      }
      const safeName = String(filename || 'documento-ciadi.pdf')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .replace(/\.+$/g, '') || 'documento-ciadi.pdf';
      const suggestedName = safeName.toLowerCase().endsWith('.pdf') ? safeName : safeName + '.pdf';
      const selection = await dialog.showSaveDialog({
        title: 'Exportar documento CIADI em PDF',
        defaultPath: suggestedName,
        buttonLabel: 'Guardar PDF',
        filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
      });
      if (selection.canceled || !selection.filePath) {
        return Object.freeze({ saved: false, cancelled: true });
      }

      const pdfWindow = windowFactory({
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
      });
      try {
        await pdfWindow.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        const bytes = await pdfWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: { top: 0, right: 0, bottom: 0, left: 0 }
        });
        await fs.writeFile(selection.filePath, bytes);
        return Object.freeze({ saved: true, filePath: selection.filePath });
      } finally {
        if (typeof pdfWindow.close === 'function') await pdfWindow.close();
      }
    }
  });
}

module.exports = { createDocumentPdfService };
