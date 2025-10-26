import React, { useEffect, useState } from 'react';
import { Container, Title, Text, Card, Group, Stack, Button, Badge, ActionIcon, Box, Modal, Select, Grid, Autocomplete, Loader, Alert } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconUpload, IconPlus, IconSchool, IconTrophy, IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { isUserLoggedIn, fetchCompletedCourses, deleteCompletedCourse, addCompletedCourse, CompletedCourse, saveUserPreferences, fetchUserFromDB, searchClasses } from '../utils/auth';
import TranscriptUpload from '../components/TranscriptUpload';
import CSMajorProgress from '../components/CSMajorProgress';
import { useDebouncedValue } from '@mantine/hooks';

const ProfilePage: React.FC = () => {
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Profile fields
  const [major, setMajor] = useState<string | null>(null);
  const [minor, setMinor] = useState<string | null>(null);
  const [expectedGraduation, setExpectedGraduation] = useState<Date | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoggedIn()) {
      return;
    }

    loadCourses();
  }, []);

  // Search courses when query changes
  useEffect(() => {
    if (!debouncedSearchQuery || debouncedSearchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const results = await searchClasses(debouncedSearchQuery, 20);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery]);

  // Load profile preferences when component mounts
  useEffect(() => {
    if (!isUserLoggedIn()) {
      setIsLoadingProfile(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const userData = await fetchUserFromDB();
        if (userData) {
          setMajor(userData.major || null);
          setMinor(userData.minor || null);
          setExpectedGraduation(userData.target_graduation ? new Date(userData.target_graduation) : null);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  // Auto-save profile preferences whenever they change
  useEffect(() => {
    if (isLoadingProfile || !isUserLoggedIn()) return;

    const saveProfile = async () => {
      setIsSavingProfile(true);
      try {
        await saveUserPreferences({
          major: major || undefined,
          minor: minor || undefined,
          target_graduation: expectedGraduation ? expectedGraduation.toISOString() : undefined,
        });
      } catch (error) {
        console.error('Failed to save profile:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to save profile changes. Please try again.',
          color: 'red',
        });
      } finally {
        setIsSavingProfile(false);
      }
    };

    const timeoutId = setTimeout(() => {
      saveProfile();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [major, minor, expectedGraduation, isLoadingProfile]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await fetchCompletedCourses();
      setCourses(data);
      setError(null);
      // Trigger refresh of CS major progress
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (completedCourseId: number, courseName: string) => {
    try {
      await deleteCompletedCourse(completedCourseId);
      await loadCourses();
      notifications.show({
        title: 'Course Removed',
        message: `${courseName} has been removed from your completed courses`,
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to delete course',
        color: 'red',
      });
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCourse) {
      notifications.show({
        title: 'Missing Information',
        message: 'Please select a course from the search results',
        color: 'red',
      });
      return;
    }

    const courseCode = `${selectedCourse.school}${selectedCourse.department} ${selectedCourse.number}`;

    try {
      await addCompletedCourse(selectedCourse.id, selectedGrade || undefined);

      setSelectedCourse(null);
      setSelectedGrade(null);
      setSearchQuery('');
      setSearchResults([]);
      setShowAddForm(false);
      await loadCourses();
      
      notifications.show({
        title: 'Course Added!',
        message: `${courseCode} has been added to your completed courses`,
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to add course',
        color: 'red',
      });
    }
  };

  const getCourseCode = (course: CompletedCourse): string => {
    return `${course.school}${course.department} ${course.number}`;
  };

  const getTotalCredits = () => {
    // Assume 4 credits per course as standard
    return courses.length * 4;
  };

  if (!isUserLoggedIn()) {
    return (
      <Container size="md" p="lg" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <Title order={2} c="bu-red" mb="xs">Please Sign In</Title>
        <Text c="dimmed">You need to sign in to view your completed courses.</Text>
      </Container>
    );
  }

  return (
    <Container size="md" p="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start" mb="xl">
        <Box>
          <Title order={2} mb="xs" c="bu-red">
            Profile
          </Title>
          <Text c="dimmed" size="sm">
            Manage your academic profile and completed courses
          </Text>
        </Box>
        {isSavingProfile && (
          <Text size="sm" c="dimmed" fs="italic">
            Saving...
          </Text>
        )}
      </Group>

      {/* Profile Fields */}
      <Card shadow="md" p="lg" radius="md" withBorder mb="xl">
        <Title order={4} mb="md">Academic Profile</Title>
        <Grid>
          <Grid.Col span={4}>
            <Select
              label="Major"
              placeholder="Select your major"
              data={[
                'Computer Science',
                'Business Administration',
                'Biology',
                'Psychology',
                'Engineering',
                'Communications',
              ]}
              value={major}
              onChange={setMajor}
              disabled={isLoadingProfile}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              label="Minor"
              placeholder="Select your minor (optional)"
              data={[
                'Computer Science',
                'Business Administration',
                'Biology',
                'Psychology',
                'Engineering',
                'Communications',
                'Mathematics',
                'Data Science',
                'Statistics',
                'Economics',
                'Philosophy',
                'History',
                'English',
              ]}
              value={minor}
              onChange={setMinor}
              clearable
              disabled={isLoadingProfile}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <DateInput
              label="Expected Graduation"
              placeholder="Select graduation date"
              value={expectedGraduation}
              onChange={(value) => {
                if (typeof value === 'string') {
                  setExpectedGraduation(value ? new Date(value) : null);
                } else {
                  setExpectedGraduation(value);
                }
              }}
              valueFormat="MMMM YYYY"
              level="month"
              disabled={isLoadingProfile}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Action Buttons */}
      <Card shadow="md" p="lg" radius="md" withBorder mb="lg">
        <Group justify="space-between" align="flex-start" mb="md">
          <Box>
            <Title order={4} mb="xs">Add Completed Courses</Title>
            <Text size="sm" c="dimmed">
              Upload your transcript or manually add courses you've already completed
            </Text>
          </Box>
        </Group>
        <Group gap="sm" grow>
          <Button
            leftSection={<IconUpload size={18} />}
            onClick={() => setShowUploadForm(!showUploadForm)}
            color="green"
            variant="light"
          >
            {showUploadForm ? 'Hide Upload' : 'Upload Transcript'}
          </Button>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => setShowAddForm(!showAddForm)}
            color="bu-red"
            variant="light"
          >
            {showAddForm ? 'Cancel' : 'Add Manually'}
          </Button>
        </Group>
      </Card>

      {/* Upload Form */}
      {showUploadForm && (
        <Box mb="lg">
          <TranscriptUpload onUploadSuccess={loadCourses} />
        </Box>
      )}

      {/* Add Course Modal */}
      <Modal 
        opened={showAddForm} 
        onClose={() => {
          setShowAddForm(false);
          setSelectedCourse(null);
          setSelectedGrade(null);
          setSearchQuery('');
          setSearchResults([]);
        }} 
        title="Add Completed Course"
        size="lg"
      >
        <form onSubmit={handleAddCourse}>
          <Stack gap="md">
            {/* Course Search */}
            <Box>
              <Autocomplete
                label="Search for Course"
                placeholder="Type to search courses (e.g., 'Computer Science', 'CS 111')"
                data={searchResults.map((course) => `${course.school}${course.department} ${course.number} - ${course.title}`)}
                value={searchQuery}
                onChange={(value: string) => {
                  setSearchQuery(value);
                  // Find and set the selected course when user types/selects
                  const matchedCourse = searchResults.find(
                    (c) => `${c.school}${c.department} ${c.number} - ${c.title}` === value
                  );
                  if (matchedCourse) {
                    setSelectedCourse(matchedCourse);
                  }
                }}
                leftSection={<IconSearch size={16} />}
                rightSection={isSearching ? <Loader size="xs" /> : null}
                limit={20}
                maxDropdownHeight={300}
                required
              />
              {selectedCourse && (
                <Card mt="sm" p="sm" withBorder bg="gray.0">
                  <Text size="sm" fw={600} c="bu-red">
                    {selectedCourse.school}{selectedCourse.department} {selectedCourse.number}
                  </Text>
                  <Text size="sm">{selectedCourse.title}</Text>
                  {selectedCourse.description && (
                    <Text size="xs" c="dimmed" mt="xs" lineClamp={2}>
                      {selectedCourse.description}
                    </Text>
                  )}
                </Card>
              )}
            </Box>

            {/* Grade Selection */}
            {selectedCourse && (
              <Select
                label="Grade (Optional)"
                placeholder="Select your grade"
                data={[
                  { value: 'A+', label: 'A+' },
                  { value: 'A', label: 'A' },
                  { value: 'A-', label: 'A-' },
                  { value: 'B+', label: 'B+' },
                  { value: 'B', label: 'B' },
                  { value: 'B-', label: 'B-' },
                  { value: 'C+', label: 'C+' },
                  { value: 'C', label: 'C' },
                  { value: 'C-', label: 'C-' },
                  { value: 'D', label: 'D' },
                  { value: 'F', label: 'F' },
                  { value: 'P', label: 'P (Pass)' },
                  { value: 'S', label: 'S (Satisfactory)' },
                ]}
                value={selectedGrade}
                onChange={setSelectedGrade}
                clearable
              />
            )}

            <Group justify="flex-end" mt="md">
              <Button 
                variant="subtle" 
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedCourse(null);
                  setSelectedGrade(null);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" color="bu-red" disabled={!selectedCourse}>
                Add Course
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Two Column Layout: Progress Dial + Completed Courses */}
      <Grid gutter="lg">
        {/* Left Column: CS Major Progress Dial */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          {/* Stats Cards */}
          <Stack gap="md" mb="lg">
            <Card shadow="sm" p="md" radius="md" withBorder>
              <Group gap="xs">
                <IconSchool size={20} color="#CC0000" />
                <Text size="sm" c="dimmed">Total Courses</Text>
              </Group>
              <Text size="xl" fw={700} mt="xs">{courses.length}</Text>
            </Card>
            <Card shadow="sm" p="md" radius="md" withBorder>
              <Group gap="xs">
                <IconTrophy size={20} color="#CC0000" />
                <Text size="sm" c="dimmed">Estimated Credits</Text>
              </Group>
              <Text size="xl" fw={700} mt="xs">{getTotalCredits()}</Text>
            </Card>
          </Stack>

          {/* CS Major Progress Dial */}
          {major === 'Computer Science' && (
            <CSMajorProgress refreshTrigger={refreshTrigger} />
          )}
          {major !== 'Computer Science' && major && (
            <Alert icon={<IconInfoCircle size={16} />} title="Major Progress" color="blue" mb="lg">
              Currently, major progress tracking is only available for Computer Science majors. 
              Your major is set to: <strong>{major}</strong>
            </Alert>
          )}
        </Grid.Col>

        {/* Right Column: Completed Courses List */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Title order={4} mb="md">Completed Courses</Title>
          {loading ? (
            <Card shadow="sm" p="xl" radius="md" withBorder style={{ textAlign: 'center' }}>
              <Text c="dimmed">Loading courses...</Text>
            </Card>
          ) : error ? (
            <Card shadow="sm" p="xl" radius="md" withBorder style={{ textAlign: 'center' }}>
              <Text c="red">{error}</Text>
            </Card>
          ) : courses.length === 0 ? (
            <Card shadow="sm" p="xl" radius="md" withBorder style={{ textAlign: 'center' }}>
              <Text c="dimmed" mb="xs">No completed courses yet.</Text>
              <Text size="sm" c="dimmed">
                Upload your transcript or add courses manually to get started.
              </Text>
            </Card>
          ) : (
            <Stack gap="md">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  shadow="md"
                  p="lg"
                  radius="md"
                  withBorder
                  style={{
                    transition: 'all 0.3s ease',
                    cursor: 'default',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                      },
                    },
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Box>
                      <Group gap="xs" mb="xs">
                        {course.grade && (
                          <Badge color="blue" variant="light">
                            Grade: {course.grade}
                          </Badge>
                        )}
                        <Badge color="gray" variant="outline">
                          4 credits
                        </Badge>
                      </Group>
                      <Title order={4} c="bu-red" mb="xs">
                        {getCourseCode(course)}
                      </Title>
                      <Text fw={600} size="md" mb="xs">
                        {course.title}
                      </Text>
                      {course.description && (
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {course.description}
                        </Text>
                      )}
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="lg"
                      onClick={() => handleDelete(course.id, getCourseCode(course))}
                      style={{ transition: 'all 0.2s ease' }}
                      styles={{
                        root: {
                          '&:hover': {
                            transform: 'scale(1.15)',
                            backgroundColor: 'rgba(204, 0, 0, 0.1)',
                          },
                        },
                      }}
                    >
                      <IconTrash size={20} />
                    </ActionIcon>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default ProfilePage;

