'use client';

import React, { useState, useRef } from 'react';
import ApplicationFormManager from './ApplicationFormManager';

interface DocumentManagerProps {
  clientId: string;
  clientName: string;
  onDocumentUpload?: (documentType: 'draft' | 'certificate', fileUrl: string) => void;
}

type DocumentType = 'application_form' | 'certificate' | 'draft';

interface Document {
  id: string;
  type: DocumentType;
  filename: string;
  uploadedAt: string;
  size: number;
}

const documentLabels = {
  application_form: 'Application Form',
  certificate: 'Certificate',
  draft: 'Draft'
};

const documentIcons = {
  application_form: '📄',
  certificate: '🏆',
  draft: '📝'
};

export default function DocumentManager({ clientId, clientName, onDocumentUpload }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [generating, setGenerating] = useState<DocumentType | null>(null);
  
  const fileInputRefs = {
    application_form: useRef<HTMLInputElement>(null),
    certificate: useRef<HTMLInputElement>(null),
    draft: useRef<HTMLInputElement>(null)
  };

  const handleFileUpload = async (type: DocumentType, file: File) => {
    setUploading(type);
    
    try {
      // Simulate file upload (replace with actual Supabase storage logic)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a mock file URL (in real implementation, this would be the actual uploaded file URL)
      const mockFileUrl = `https://example.com/files/${clientId}/${type}/${file.name}`;
      
      const newDocument: Document = {
        id: Date.now().toString(),
        type,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        size: file.size
      };
      
      setDocuments(prev => [...prev.filter(doc => doc.type !== type), newDocument]);
      
      // Reset file input
      if (fileInputRefs[type].current) {
        fileInputRefs[type].current.value = '';
      }
      
      // Call the callback to update the client record with file URL
      if (onDocumentUpload && (type === 'draft' || type === 'certificate')) {
        onDocumentUpload(type, mockFileUrl);
      }
      
    } catch (error) {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const handleFileSelect = (type: DocumentType) => {
    const input = fileInputRefs[type].current;
    if (input?.files?.[0]) {
      handleFileUpload(type, input.files[0]);
    }
  };

  const handleDownload = (document: Document) => {
    // Simulate download (replace with actual download logic)
    const link = document.createElement('a');
    link.href = '#'; // Replace with actual file URL
    link.download = document.filename;
    link.click();
  };

  const handleGenerate = async (type: DocumentType) => {
    setGenerating(type);
    
    try {
      // Simulate document generation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const generatedDocument: Document = {
        id: Date.now().toString(),
        type,
        filename: `${type}_${clientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
        uploadedAt: new Date().toISOString(),
        size: Math.floor(Math.random() * 1000000) + 100000 // Random size
      };
      
      setDocuments(prev => [...prev.filter(doc => doc.type !== type), generatedDocument]);
      
      // Generate a mock file URL for generated documents
      const mockFileUrl = `https://example.com/generated/${clientId}/${type}/${generatedDocument.filename}`;
      
      // Call the callback to update the client record with file URL
      if (onDocumentUpload && (type === 'draft' || type === 'certificate')) {
        onDocumentUpload(type, mockFileUrl);
      }
      
    } catch (error) {
      alert('Generation failed. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDocumentByType = (type: DocumentType) => {
    return documents.find(doc => doc.type === type);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Document Management</h3>
        <div className="text-sm text-gray-500">
          Upload or generate documents for {clientName}
        </div>
      </div>
      
      {/* Application Form Section */}
      <ApplicationFormManager 
        clientId={clientId}
        clientName={clientName}
        onDraftGenerated={(fileUrl) => {
          if (onDocumentUpload) {
            onDocumentUpload('draft', fileUrl);
          }
        }}
      />
      
      <div className="space-y-6">
        {(['certificate', 'draft'] as DocumentType[]).map((type) => {
          const document = getDocumentByType(type);
          const isUploading = uploading === type;
          const isGenerating = generating === type;
          
          return (
            <div key={type} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{documentIcons[type]}</span>
                  <h4 className="font-medium text-gray-900">{documentLabels[type]}</h4>
                </div>
                
                {document && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    ✓ Available
                  </span>
                )}
              </div>
              
              {document ? (
                <div className="bg-gray-50 rounded-md p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{document.filename}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(document.size)} • Uploaded {formatDate(document.uploadedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(document)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 mb-3">
                  No {documentLabels[type].toLowerCase()} uploaded
                </div>
              )}
              
              <div className="flex gap-2">
                {/* Upload Button */}
                <div className="relative">
                  <input
                    ref={fileInputRefs[type]}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={() => handleFileSelect(type)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRefs[type].current?.click()}
                    disabled={isUploading || isGenerating}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload
                      </>
                    )}
                  </button>
                </div>
                
                {/* Generate Button */}
                  <button
                    onClick={() => handleGenerate(type)}
                    disabled={isUploading || isGenerating}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Generate
                      </>
                    )}
                  </button>
              </div>
              
              {type === 'certificate' && (
                <p className="text-xs text-gray-500 mt-2">
                  💡 Generate certificate automatically from approved draft
                </p>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 p-3 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Document Integration:</strong> When you upload a draft or certificate, it will automatically update the client record and appear in the "Document Files" section of the Client Information tab.
        </p>
      </div>
    </div>
  );
}