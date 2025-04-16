import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm bg-destructive hover:bg-destructive/80 text-destructive-foreground rounded-md transition-colors"
            onClick={onConfirm}
          >
            Delete All
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
