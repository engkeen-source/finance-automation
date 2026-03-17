import { useState, useRef, useCallback } from 'react';

export function FileUpload() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setMessage(`Uploaded: ${file.name}`);
      } else {
        setMessage(`Upload failed: ${file.name}`);
      }
    } catch {
      setMessage('Upload failed');
    } finally {
      setUploading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      files.forEach(uploadFile);
    },
    [uploadFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(uploadFile);
    },
    [uploadFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '32px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: dragging ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <div style={{ fontSize: 32, marginBottom: 8 }}>
        {uploading ? '...' : '+'}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        {uploading
          ? 'Uploading...'
          : 'Drop invoice files here or click to upload'}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
        PDF, PNG, JPG, TIFF supported
      </div>
      {message && (
        <div style={{ color: 'var(--success)', fontSize: 13, marginTop: 8 }}>
          {message}
        </div>
      )}
    </div>
  );
}
