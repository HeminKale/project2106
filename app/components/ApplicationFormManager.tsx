'use client';

import React, { useState } from 'react';
import { supabase } from '@/app/lib/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';

interface ApplicationFormManagerProps {
  clientId: string;
  onDraftGenerated: (draftUrl: string) => void;
}

interface ApplicationFormData {
  company_name: string;
  email: string;
  contact_no: string;
  address: string;
  country: string;
  scope: string;
  website?: string;
  iso_standard: string;
  years_required: number;
  director_name: string;
  company_registration_no: string;
  company_registration_date: string;
  employee1_name: string;
  employee1_designation: string;
  employee2_name: string;
  employee2_designation: string;
  employee3_name: string;
  employee3_designation: string;
}

export default function ApplicationFormManager({ clientId, onDraftGenerated }: ApplicationFormManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationFormUrl, setApplicationFormUrl] = useState<string | null>(null);
  const [uploadedDocxFileName, setUploadedDocxFileName] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);

      if (!user) {
        throw new Error('You must be logged in to upload files.');
      }

      const file = event.target.files?.[0];
      if (!file) {
        throw new Error('Please select a file');
      }

      console.log('Uploading for client ID:', clientId);
      console.log('Authenticated user ID (from context):', user.id);
      console.log('File object:', { name: file.name, type: file.type, size: file.size });

      // Check if file is a Word document
      if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
        throw new Error('Please upload a Word document (.doc or .docx)');
      }

      // Upload the Word document to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${clientId}/application_form.${fileExt}`;
      console.log('Attempting to upload file with name:', fileName);
      const { error: uploadError, data } = await supabase.storage
        .from('application-forms')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Supabase Storage Upload Error:', uploadError);
        throw uploadError;
      }
      console.log('Supabase Storage Upload Data:', data);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('application-forms')
        .getPublicUrl(fileName);

      setApplicationFormUrl(publicUrl);
      setUploadedDocxFileName(fileName);

      // Update client record with application form URL
      const { error: updateError } = await supabase
        .from('clients')
        .update({ application_form_url: publicUrl })
        .eq('id', clientId);

      if (updateError) {
        throw updateError;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  const generateDraft = async () => {
    try {
      setGeneratingDraft(true);
      setError(null);

      if (!applicationFormUrl) {
        throw new Error('Please upload an application form first');
      }

      // Call our document processing API
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          fileName: uploadedDocxFileName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate draft');
      }

      const { draftUrl } = await response.json();
      console.log('Draft URL received:', draftUrl);
      
      onDraftGenerated(draftUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGeneratingDraft(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Application Form
        </label>
        <div className="mt-1">
          <input
            type="file"
            accept=".doc,.docx"
            onChange={handleFileUpload}
            disabled={uploading || authLoading || !user}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      {applicationFormUrl && (
        <div className="flex items-center space-x-4">
          <button
            onClick={generateDraft}
            disabled={generatingDraft || authLoading || !user || !applicationFormUrl}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {generatingDraft ? 'Generating Draft...' : 'Generate Draft'}
          </button>
          <a
            href={applicationFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            View Application Form
          </a>
        </div>
      )}
    </div>
  );
} 