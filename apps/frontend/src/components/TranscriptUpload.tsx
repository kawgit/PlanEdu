import React, { useState } from 'react';
import { uploadTranscript } from '../utils/auth';

interface TranscriptUploadProps {
  onUploadSuccess?: () => void;
}

const TranscriptUpload: React.FC<TranscriptUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    coursesExtracted: number;
    coursesInserted: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      if (!selectedFile.type.startsWith('image/') && selectedFile.type !== 'application/pdf') {
        setError('Please select an image or PDF file');
        return;
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadTranscript(file);
      setSuccess({
        coursesExtracted: result.coursesExtracted,
        coursesInserted: result.coursesInserted,
      });
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('transcript-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload transcript');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Upload Transcript</h2>
      <p className="text-gray-600 mb-4">
        Upload your transcript (image or PDF) and we'll automatically extract the courses you've already taken,
        including AP courses and BU courses.
      </p>

      <div className="space-y-4">
        <div>
          <label 
            htmlFor="transcript-upload" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Transcript File
          </label>
          <input
            id="transcript-upload"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            'Upload & Extract Courses'
          )}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            <p className="font-medium">Success!</p>
            <p className="text-sm">
              Extracted {success.coursesExtracted} course{success.coursesExtracted !== 1 ? 's' : ''} 
              {' '}and saved {success.coursesInserted} to your profile.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="font-medium text-blue-900 mb-2">Tips for best results:</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Make sure the transcript is clear and readable</li>
          <li>Include all pages if you have multiple pages</li>
          <li>Both official transcripts and screenshots work</li>
          <li>You can also add courses manually if needed</li>
        </ul>
      </div>
    </div>
  );
};

export default TranscriptUpload;

