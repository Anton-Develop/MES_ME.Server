import { jsPDF } from "jspdf";
import RobotoRegular from "../fonts/Roboto-Regular.ttf";
import RobotoBold from "../fonts/Roboto-Bold.ttf";

/**
 * Safely converts an ArrayBuffer to a Base64 string in chunks 
 * to avoid "Maximum call stack size exceeded" errors.
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let chunkSize = 8192; // Safe chunk size for String.fromCharCode.apply
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    
    return btoa(binary);
}

export async function registerFonts(pdf) {
    // Fetch font files as ArrayBuffers
    const regular = await fetch(RobotoRegular).then(r => r.arrayBuffer());
    const bold = await fetch(RobotoBold).then(r => r.arrayBuffer());

    // Register Regular font
    pdf.addFileToVFS("Roboto-Regular.ttf", arrayBufferToBase64(regular));
    pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");

    // Register Bold font
    pdf.addFileToVFS("Roboto-Bold.ttf", arrayBufferToBase64(bold));
    pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");
}