'use strict';

function createDocumentPdfService({ dialog, windowFactory, fs }) {
  if (!dialog?.showSaveDialog || typeof windowFactory !== 'function' || !fs?.writeFile) {
    throw new Error('Dependências do serviço de exportação PDF incompletas.');
  }

  return Object.freeze({
    async renderPdfBytes({ html }) {
      if (typeof html !== 'string' || !html.trim()) {
        throw new Error('HTML do documento obrigatório para gerar PDF.');
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
          preferCSSPageSize: true
        });
        return Uint8Array.from(bytes);
      } finally {
        if (typeof pdfWindow.close === 'function') await pdfWindow.close();
      }
    },
    async exportIssuedPdf({ document, bytes, mimeType, filename }) {
      if (!document || document.status !== 'issued') {
        throw new Error('A exportação PDF exige um documento emitido.');
      }
      if (!bytes) throw new Error('Os bytes do PDF oficial arquivado são obrigatórios.');
      if (mimeType !== 'application/pdf') throw new Error('O ficheiro arquivado não é PDF.');
      const output = bytes instanceof ArrayBuffer
        ? Buffer.from(bytes)
        : ArrayBuffer.isView(bytes)
          ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          : Buffer.from(bytes);
      if (output.length < 5 || output.length > 10 * 1024 * 1024 ||
          output.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error('O ficheiro arquivado não contém uma assinatura PDF válida ou excede 10 MiB.');
      }
      const safeName = String(filename || 'documento-ciadi.pdf')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/[\u0000-\u001f]/g, '_')
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
      await fs.writeFile(selection.filePath, output);
      return Object.freeze({ saved: true, filePath: selection.filePath, source: 'archive' });
    }
  });
}

module.exports = { createDocumentPdfService };
