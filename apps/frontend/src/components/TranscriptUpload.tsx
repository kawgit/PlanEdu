import React, { useState } from 'react';
import { Card, Title, Text, Button, Group, Stack, FileButton, Alert, List } from '@mantine/core';
import { IconUpload, IconCheck, IconAlertCircle, IconFileUpload } from '@tabler/icons-react';
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

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;

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

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload transcript';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card 
      shadow="md" 
      p="lg" 
      radius="md" 
      withBorder
      style={{ transition: 'all 0.3s ease' }}
      styles={{
        root: {
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          },
        },
      }}
    >
      <Group mb="md">
        <IconFileUpload size={24} color="#CC0000" />
        <Title order={3}>Upload Transcript</Title>
      </Group>

      <Text c="dimmed" size="sm" mb="lg">
        Upload your transcript (image or PDF) and we'll automatically extract the courses you've already taken,
        including AP courses and BU courses.
      </Text>

      <Stack gap="md">
        <FileButton onChange={handleFileChange} accept="image/*,application/pdf">
          {(props) => (
            <Button 
              {...props}
              leftSection={<IconUpload size={18} />}
              variant="light"
              color="blue"
              fullWidth
              disabled={uploading}
            >
              {file ? 'Change File' : 'Select Transcript File'}
            </Button>
          )}
        </FileButton>

        {file && (
          <Alert color="blue" title="File Selected" icon={<IconCheck size={18} />}>
            <Text size="sm">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </Text>
          </Alert>
        )}

        {file && (
          <Button
            onClick={handleUpload}
            loading={uploading}
            color="bu-red"
            fullWidth
            size="md"
            leftSection={<IconUpload size={18} />}
            style={{ transition: 'all 0.3s ease' }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(204, 0, 0, 0.3)',
                },
              },
            }}
          >
            {uploading ? 'Processing...' : 'Upload & Extract Courses'}
          </Button>
        )}

        {error && (
          <Alert color="red" title="Error" icon={<IconAlertCircle size={18} />}>
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {success && (
          <Alert color="green" title="Success!" icon={<IconCheck size={18} />}>
            <Text size="sm">
              Extracted {success.coursesExtracted} course{success.coursesExtracted !== 1 ? 's' : ''} 
              {' '}and saved {success.coursesInserted} to your profile.
            </Text>
          </Alert>
        )}

        <Card withBorder p="md" radius="md" bg="blue.0">
          <Text fw={600} size="sm" mb="xs" c="blue.9">
            Tips for best results:
          </Text>
          <List size="sm" spacing="xs" c="blue.7">
            <List.Item>Make sure the transcript is clear and readable</List.Item>
            <List.Item>Include all pages if you have multiple pages</List.Item>
            <List.Item>Both official transcripts and screenshots work</List.Item>
            <List.Item>You can also add courses manually if needed</List.Item>
          </List>
        </Card>
      </Stack>
    </Card>
  );
};

export default TranscriptUpload;
