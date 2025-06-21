import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import WordExtractor from 'word-extractor';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Array of valid ISO standards from your Supabase enum
const VALID_ISO_STANDARDS = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2013',
  'ISO 22000:2018',
  'ISO 13485:2016',
  'ISO 50001:2018',
];

// URL of the pre-designed PDF template
const TEMPLATE_PDF_URL = 'https://asiblnmsifvfutvrdsjj.supabase.co/storage/v1/object/public/template/b8f0b5c8-f579-4241-8a0f-ed287c543814/Draft.pdf';

// Removed global supabase client initialization to create it per request with user token
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { clientId, fileName: filePathInBucket } = await request.json();
    console.log('API: Received request for client:', clientId, 'file path:', filePathInBucket);

    // Retrieve the authorization token from the request headers
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new Error('Authorization token missing.');
    }

    // Initialize Supabase client with the user's access token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('application-forms')
      .download(filePathInBucket);

    if (downloadError) {
      console.error('API: Supabase Storage Download Error:', JSON.stringify(downloadError, null, 2));
      throw new Error(`Failed to download file: ${downloadError.message || 'Unknown download error'}`);
    }

    if (!fileData) {
      throw new Error('Downloaded file data is empty or null.');
    }

    console.log('API: Downloaded fileData (Blob): ', fileData); // Log the Blob

    // Convert the Blob to an ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    console.log('API: Converted to ArrayBuffer, byteLength:', arrayBuffer.byteLength); // Log ArrayBuffer size

    if (arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded file is empty.');
    }

    // Convert ArrayBuffer to Node.js Buffer
    const fileBuffer = Buffer.from(arrayBuffer);

    // Convert the file to text using word-extractor
    let text = '';
    try {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(fileBuffer);
      text = doc.getBody(); // Get the body text

      console.log('API: Extracted text from document using word-extractor:', text.substring(0, 200) + '...'); // Log first 200 chars
    } catch (wordExtractorError) {
      console.error('API: Error extracting text with word-extractor:', wordExtractorError);
      throw new Error(`Failed to extract text with word-extractor: ${wordExtractorError instanceof Error ? wordExtractorError.message : 'Unknown word-extractor error'}`);
    }

    // Extract fields using regex patterns
    const fields = {
      companyName: extractField(text, /Company Name:?\s*([^\n]+)/i),
      address: extractField(text, /Address:?\s*([^\n]+)/i),
      // Broader extraction for ISO Standard, then refine
      isoStandardRaw: extractField(text, /ISO Standard:?\s*([^\n]+)/i), // Extract raw string
      scope: extractField(text, /Scope:?\s*([^\n]+)/i),
      directorName: extractField(text, /Director Name:?\s*([^\n]+)/i),
      registrationNo: extractField(text, /Registration No:?\s*([^\n]+)/i),
    };

    let isoStandard = '';
    // Attempt to find an exact match first
    for (const standard of VALID_ISO_STANDARDS) {
      if (fields.isoStandardRaw.includes(standard)) {
        isoStandard = standard;
        break;
      }
    }

    // If no exact match, try to find a partial match and map it
    if (!isoStandard) {
      for (const standard of VALID_ISO_STANDARDS) {
        // Example: match "ISO 22000" to "ISO 22000:2018"
        const shortStandard = standard.split(':')[0];
        if (fields.isoStandardRaw.includes(shortStandard)) {
          isoStandard = standard;
          break;
        }
      }
    }

    if (!isoStandard) {
      throw new Error(`Could not identify a valid ISO Standard from the document text: "${fields.isoStandardRaw}". Please ensure it contains one of the following: ${VALID_ISO_STANDARDS.join(', ')}`);
    }
    console.log('API: Identified ISO Standard:', isoStandard);

    // Get system type mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('draft_mappings')
      .select('system_type')
      .eq('iso_standard', isoStandard) // Use the identified isoStandard
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

    // --- PDF Generation using Template --- 
    console.log('API: Fetching PDF template from:', TEMPLATE_PDF_URL);
    const templatePdfBytes = await fetch(TEMPLATE_PDF_URL).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(templatePdfBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0]; // Assuming content goes on the first page

    const { width, height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold); // Using a bold font for emphasis

    // Example: Drawing extracted fields onto the template
    // YOU WILL NEED TO ADJUST THESE X, Y, AND SIZE VALUES BASED ON YOUR TEMPLATE'S DESIGN

    // Company Name
    firstPage.drawText(fields.companyName, {
      x: 200, // Placeholder X
      y: height - 300, // Placeholder Y
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });

    // ISO Standard
    firstPage.drawText(isoStandard, {
      x: 200, // Placeholder X
      y: height - 350, // Placeholder Y
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    // Scope
    firstPage.drawText(fields.scope,
      {
        x: 100,
        y: height - 400,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

    // Certificate Number (generated)
    firstPage.drawText(certificateNumber, {
      x: 200,
      y: height - 500,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    // Issue Date (generated)
    firstPage.drawText(currentDate.toLocaleDateString('en-US'), {
      x: 200,
      y: height - 520,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    // Valid Until (generated)
    firstPage.drawText(validUntil.toLocaleDateString('en-US'), {
      x: 200,
      y: height - 540,
      size: 12,
      font,
      color: rgb(0, 0, 0),
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