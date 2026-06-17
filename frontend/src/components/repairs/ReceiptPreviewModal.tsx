import { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Loader2, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReceiptPreviewModalProps {
  id: string;
  jobNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptPreviewModal({
  id,
  jobNumber,
  isOpen,
  onClose
}: ReceiptPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let activeUrl: string | null = null;

    const fetchPdf = async () => {
      if (!isOpen || !id) return;
      setIsLoading(true);
      try {
        const token = localStorage.getItem('gk_access_token');
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/repairs/${id}/receipt`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch PDF receipt');
        }
        
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        activeUrl = objectUrl;
        setPdfUrl(objectUrl);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Could not load receipt preview');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    fetchPdf();

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
      setPdfUrl(null);
    };
  }, [isOpen, id, onClose]);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.setAttribute('download', `${jobNumber}-receipt.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Download initiated!');
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    } else {
      toast.error('Pop-up was blocked. Please allow popups for printing.');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Receipt Preview - ${jobNumber}`}
      description="View, print or download repair ticket receipt."
    >
      <div className="space-y-4">
        {/* Iframe Preview Panel */}
        <div className="relative border border-border/80 bg-slate-950 rounded-xl h-[480px] w-full flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Rendering Receipt...</span>
            </div>
          ) : pdfUrl ? (
            <iframe 
              src={`${pdfUrl}#toolbar=0&navpanes=0`} 
              className="h-full w-full rounded-xl"
              title="Receipt PDF Preview"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Preview unavailable</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex justify-between items-center border-t border-border/40 pt-4 mt-6">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              disabled={isLoading || !pdfUrl}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              disabled={isLoading || !pdfUrl}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </Button>
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
