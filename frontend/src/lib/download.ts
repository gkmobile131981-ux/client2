import { apiClient, ApiError } from './api';

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function assertPdfBlob(blob: Blob) {
  const type = (blob.type || '').toLowerCase();
  if (type && (type.includes('json') || type.includes('html') || type.includes('text/'))) {
    throw new ApiError('Server returned an unexpected response. Please try again.', 502);
  }
}

export async function fetchRepairReceiptBlob(id: string): Promise<Blob> {
  const blob = await apiClient.getBlob<Blob>(`/repairs/${id}/receipt`);
  assertPdfBlob(blob);
  return blob;
}

export async function downloadRepairReceipt(id: string, jobNumber: string): Promise<void> {
  const blob = await fetchRepairReceiptBlob(id);
  triggerBlobDownload(blob, `${jobNumber}-receipt.pdf`);
}
