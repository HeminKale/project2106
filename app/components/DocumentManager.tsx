'use client';

import React, { useState, useRef, useEffect } from 'react';
import ApplicationFormManager from './ApplicationFormManager';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

interface DocumentManagerProps {
  clientId: string;
  onDraftGenerated: (url: string) => Promise<void>;
  onCertificateGenerated: (url: string) => Promise<void>;
  clientStatus: string;
  applicationFormUrl: string | null;
  draftUrl: string | null;
  certificateUrl?: string | null;
}

type DocumentType = 'application_form' | 'certificate' | 'draft';

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

export default function DocumentManager({
  clientId,
  onDraftGenerated,
  onCertificateGenerated,
  clientStatus,
  applicationFormUrl,
  draftUrl,
  certificateUrl,
}: DocumentManagerProps) {
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [generating, setGenerating] = useState<DocumentType | null>(null);

  const fileInputRefs = {
    certificate: useRef<HTMLInputElement>(null),
    draft: useRef<HTMLInputElement>(null)
  };

  // Function to handle file uploads for Draft and Certificate
  const handleFileUpload = async (type: 'draft' | 'certificate', file: File) => {
    setUploading(type);
    try {
      const filePath = `${clientId}/${type}/${file.name}`;
      const { data, error } = await supabase.storage
        .from('client-documents') // Assuming a bucket named 'client-documents'
        .upload(filePath, file, { upsert: true });

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(filePath);

      if (type === 'draft') {
        await onDraftGenerated(publicUrl);
      } else if (type === 'certificate') {
        await onCertificateGenerated(publicUrl);
      }

    } catch (error: any) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Failed to upload ${documentLabels[type]}: ` + error.message);
    } finally {
      setUploading(null);
      // Clear the file input
      if (fileInputRefs[type].current) {
        fileInputRefs[type].current.value = '';
      }
    }
  };

  // Function to handle generation for Draft (if needed, this can be moved to ApplicationFormManager)
  const handleGenerate = async (type: 'draft') => {
    setGenerating(type);
    try {
      // This logic should ideally be handled in ApplicationFormManager as it's specific to the draft generation process.
      // For now, we'll simulate or call a general draft generation, if still needed.
      // In the context of ApplicationFormManager handling draft generation, this block might become redundant.

      // Example: If a draft needs to be generated based on existing application form data (which ApplicationFormManager does)
      // This part might be better triggered by a separate action or within ApplicationFormManager itself.
      alert('Draft generation is typically initiated from the Application Form section.');
      // For now, let's assume draft generation is done via ApplicationFormManager and its callback.

    } finally {
      setGenerating(null);
    }
  };

  const handleFileSelect = (type: 'certificate' | 'draft', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(type, file);
    }
  };

  const isFileUploaded = (type: DocumentType) => {
    if (type === 'application_form') return applicationFormUrl !== null;
    if (type === 'draft') return draftUrl !== null;
    // For certificate, we check if it's been sent/generated
    return clientStatus === 'certificate_sent' || clientStatus === 'closed_won' || clientStatus === 'closed_lost';
  };

  const getFileUrl = (type: DocumentType) => {
    if (type === 'application_form') return applicationFormUrl;
    if (type === 'draft') return draftUrl;
    if (type === 'certificate') return certificateUrl;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Application Form Section - Delegated to ApplicationFormManager */}
      <ApplicationFormManager
        clientId={clientId}
        onDraftGenerated={onDraftGenerated} // Pass the onDraftGenerated from parent
      />

      {/* Other Documents: Draft and Certificate */}
      {(['draft', 'certificate'] as ('draft' | 'certificate')[])
        .map((type) => {
          const uploaded = isFileUploaded(type);
          const fileUrl = getFileUrl(type);
          const isUploading = uploading === type;
          const isGenerating = generating === type;

          return (
            <div key={type} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{documentIcons[type]}</span>
                  <h4 className="font-medium text-gray-900">{documentLabels[type]}</h4>
                </div>

                {uploaded && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    ✓ Available
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <label className="block">
                  <input
                    type="file"
                    accept={type === 'draft' ? '.doc,.docx,.pdf' : '.pdf'} // Accept PDF for certificate and draft (if not word)
                    onChange={(e) => handleFileSelect(type, e)}
                    disabled={isUploading || isGenerating}
                    ref={fileInputRefs[type]}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                </label>
                {fileUrl && (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Download {documentLabels[type]}
                  </a>
                )}
                {type === 'draft' && !fileUrl && clientStatus === 'application_form_received' && (
                  <button
                    onClick={() => handleGenerate('draft')} // This should ideally be triggered from ApplicationFormManager
                    disabled={isGenerating || isUploading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Draft'}
                  </button>
                )}
              </div>

              {(isUploading || isGenerating) && (
                <p className="mt-2 text-sm text-gray-500">{isUploading ? 'Uploading...' : 'Generating...'}</p>
              )}
            </div>
          );
        })}
    </div>
  );
}