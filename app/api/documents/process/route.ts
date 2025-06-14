import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { clientId, fileUrl } = await request.json();
    console.log('API: Received request for client:', clientId, 'file:', fileUrl);

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('application-forms')
      .download(fileUrl);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert the Blob to an ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();

    // Convert the file to text using mammoth
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    console.log('API: Extracted text from document:', text.substring(0, 200) + '...'); // Log first 200 chars

    // Extract fields using regex patterns
    const fields = {
      companyName: extractField(text, /Company Name:?\s*([^\n]+)/i),
      address: extractField(text, /Address:?\s*([^\n]+)/i),
      isoStandard: extractField(text, /ISO Standard:?\s*([^\n]+)/i),
      scope: extractField(text, /Scope:?\s*([^\n]+)/i),
      directorName: extractField(text, /Director Name:?\s*([^\n]+)/i),
      registrationNo: extractField(text, /Registration No:?\s*([^\n]+)/i),
    };

    // Get system type mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('draft_mappings')
      .select('system_type')
      .eq('iso_standard', fields.isoStandard)
      .single();

    if (mappingError) {
      console.error('API: Error fetching draft mapping:', mappingError.message);
      throw new Error(`Failed to get system type mapping: ${mappingError.message}`);
    }
    console.log('API: Found system type mapping:', mapping.system_type);

    // Generate certificate number
    const timestamp = new Date().getTime();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const certificateNumber = `CERT-${timestamp}-${randomNum}`;

    // Calculate dates
    const currentDate = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 3);

    // Create PDF draft
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add content to PDF
    page.drawText('DRAFT', {
      x: width / 2 - 50,
      y: height - 50,
      size: 20,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });

    page.drawText(`Certificate Number: ${certificateNumber}`, {
      x: 50,
      y: height - 100,
      size: 12,
      font,
    });

    page.drawText(`This is to certify that`, {
      x: 50,
      y: height - 150,
      size: 12,
      font,
    });

    page.drawText(fields.companyName, {
      x: 50,
      y: height - 180,
      size: 14,
      font,
    });

    page.drawText(`has been assessed and found to conform to the requirements of`, {
      x: 50,
      y: height - 210,
      size: 12,
      font,
    });

    page.drawText(`${mapping.system_type} of`, {
      x: 50,
      y: height - 240,
      size: 12,
      font,
    });

    page.drawText(fields.scope, {
      x: 50,
      y: height - 270,
      size: 12,
      font,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log('API: PDF generated successfully, size:', pdfBytes.byteLength, 'bytes');

    // Upload PDF to Supabase Storage
    console.log('API: Attempting to upload draft to path:', `${clientId}/draft.pdf`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('drafts')
      .upload(`${clientId}/draft.pdf`, pdfBytes, {
        contentType: 'application/pdf',
      });

    if (uploadError) {
      console.error('API: Error uploading draft to storage:', uploadError.message);
      throw new Error(`Failed to upload draft: ${uploadError.message}`);
    }
    console.log('API: Draft uploaded successfully, data:', uploadData);

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('drafts')
      .getPublicUrl(`${clientId}/draft.pdf`);
    console.log('API: Generated public URL:', publicUrl);

    // Update client record
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        draft_uploaded: true,
        draft_url: publicUrl,
        certificate_number: certificateNumber,
        issue_date: currentDate.toISOString(),
        valid_until: validUntil.toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('API: Error updating client record:', updateError.message);
      throw new Error(`Failed to update client record: ${updateError.message}`);
    }
    console.log('API: Client record updated successfully with draft URL:', publicUrl);

    return NextResponse.json({
      success: true,
      draftUrl: publicUrl,
      fields,
    });
  } catch (error) {
    console.error('API: Caught error in POST handler:', error); // More general error logging
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}

function extractField(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
} 