// src/components/PrintStyles.jsx
import { GlobalStyles } from '@mui/material';

export default function PrintStyles() {
    return (
        <GlobalStyles
            styles={{
                '@page': {
                    size: 'A4 landscape',
                    margin: '8mm',
                },
                '@media print': {
                    'html, body': {
                        width: '297mm !important',
                        height: '210mm !important',
                        margin: '0 !important',
                        padding: '0 !important',
                        background: '#fff !important',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                    },
                    '.no-print, button, .MuiAlert-root, .MuiCircularProgress-root': {
                        display: 'none !important',
                    },
                    '.report-container': {
                        padding: '0 !important',
                        margin: '0 !important',
                        width: '100%',
                    },
                    '.page-heating': {
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                        height: '194mm',
                        overflow: 'hidden',
                    },
                    '.page-tempering': {
                        pageBreakBefore: 'always',
                        breakBefore: 'page',
                        height: '194mm',
                        overflow: 'hidden',
                    },
                    '.chart-container': {
                        height: '110mm !important',
                        maxHeight: '110mm !important',
                        width: '150% !important',
                    },
                    '.chart-container svg': {
                        width: '60% !important',
                        height: '150% !important',
                    },
                    '.MuiPaper-root': {
                        boxShadow: 'none !important',
                        borderRadius: '0 !important',
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                    },
                },
            }}
        />
    );
}