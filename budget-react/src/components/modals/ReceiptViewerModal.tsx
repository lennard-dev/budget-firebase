import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Download, Maximize2 } from 'lucide-react';

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string;
}

const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  isOpen,
  onClose,
  receiptUrl
}) => {
  const handleDownload = () => {
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = receiptUrl;
    link.download = receiptUrl.split('/').pop() || 'receipt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(receiptUrl, '_blank');
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    Receipt Viewer
                  </Dialog.Title>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownload}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleOpenInNewTab}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 bg-gray-50" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {receiptUrl.endsWith('.pdf') ? (
                    <iframe
                      src={receiptUrl}
                      className="w-full h-[60vh] border border-gray-200 rounded-lg"
                      title="Receipt PDF"
                    />
                  ) : (
                    <img
                      src={receiptUrl}
                      alt="Receipt"
                      className="w-full h-auto rounded-lg shadow-sm"
                    />
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ReceiptViewerModal;