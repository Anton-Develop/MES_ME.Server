export async function savePdf(pdf, meta) {

    const fileName =
        `${meta.melt}-${meta.partNo}-${meta.pack}-${meta.sheet}.pdf`;

    if (window.showSaveFilePicker) {

        const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{
                description: 'PDF',
                accept: {
                    'application/pdf': ['.pdf']
                }
            }]
        });

        const writable = await handle.createWritable();

        await writable.write(pdf.output('blob'));

        await writable.close();
    }
    else {
        pdf.save(fileName);
    }
}