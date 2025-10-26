import React, { useEffect, useState } from 'react';
import { Container, Title, Text, Card, Group, Stack, Button, Badge, ActionIcon, Box, Modal, TextInput, Select, NumberInput, Grid, Autocomplete, Loader } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconUpload, IconPlus, IconCertificate, IconSchool, IconTrophy, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { isUserLoggedIn, fetchCompletedCourses, deleteCompletedCourse, addCompletedCourse, CompletedCourse, saveUserPreferences, fetchUserFromDB, searchClasses } from '../utils/auth';
import TranscriptUpload from '../components/TranscriptUpload';
import { useDebouncedValue } from '@mantine/hooks';

const CompletedCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'All' | 'AP' | 'BU' | 'Transfer' | 'Other'>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  
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
  const [formData, setFormData] = useState({
    grade: '',
    credits: '',
    semesterTaken: '',
    courseType: 'BU' as 'AP' | 'BU' | 'Transfer' | 'Other',
  });

  useEffect(() => {
    if (!isUserLoggedIn()) {
      return;
    }

    loadCourses();
  }, [filterType]);

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
      const courseType = filterType === 'All' ? undefined : filterType;
      const data = await fetchCompletedCourses(courseType);
      setCourses(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (courseId: number, courseName: string) => {
    try {
      await deleteCompletedCourse(courseId);
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
      await addCompletedCourse({
        courseCode: courseCode,
        courseTitle: selectedCourse.title,
        grade: formData.grade || undefined,
        credits: formData.credits ? parseFloat(formData.credits) : 4,
        semesterTaken: formData.semesterTaken || undefined,
        courseType: formData.courseType,
      });

      setSelectedCourse(null);
      setSearchQuery('');
      setSearchResults([]);
      setFormData({
        grade: '',
        credits: '',
        semesterTaken: '',
        courseType: 'BU',
      });
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

  const getCourseTypeColor = (type: string): string => {
    switch (type) {
      case 'AP': return 'violet';
      case 'BU': return 'blue';
      case 'Transfer': return 'green';
      default: return 'gray';
    }
  };

  const getTotalCredits = () => {
    if (!courses || courses.length === 0) return 0;
    const total = courses.reduce((sum, course) => {
      const credits = parseFloat(String(course.credits || 0));
      return sum + (isNaN(credits) ? 0 : credits);
    }, 0);
    return total;
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
          setSearchQuery('');
          setSearchResults([]);
          setFormData({
            grade: '',
            credits: '',
            semesterTaken: '',
            courseType: 'BU',
          });
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
                data={searchResults.map((course) => ({
                  value: `${course.school}${course.department} ${course.number} - ${course.title}`,
                  label: `${course.school}${course.department} ${course.number} - ${course.title}`,
                  course: course,
                }))}
                value={searchQuery}
                onChange={setSearchQuery}
                onOptionSubmit={(value, option: any) => {
                  setSelectedCourse(option.course);
                  setSearchQuery(value);
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

            {/* Additional Details */}
            {selectedCourse && (
              <>
                <Select
                  label="Course Type"
                  data={[
                    { value: 'BU', label: 'BU Course' },
                    { value: 'AP', label: 'AP Course' },
                    { value: 'Transfer', label: 'Transfer Course' },
                    { value: 'Other', label: 'Other' },
                  ]}
                  value={formData.courseType}
                  onChange={(value) => setFormData({ ...formData, courseType: value as any })}
                  required
                />
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Grade"
                      placeholder="e.g., A, B+, or 5 for AP"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Credits"
                      placeholder="e.g., 4"
                      value={formData.credits}
                      onChange={(value) => setFormData({ ...formData, credits: String(value) })}
                      decimalScale={1}
                      step={0.5}
                      min={0}
                      defaultValue={4}
                    />
                  </Grid.Col>
                </Grid>
                <TextInput
                  label="Semester Taken"
                  placeholder="e.g., Fall 2024 or Test Credit"
                  value={formData.semesterTaken}
                  onChange={(e) => setFormData({ ...formData, semesterTaken: e.target.value })}
                />
              </>
            )}

            <Group justify="flex-end" mt="md">
              <Button 
                variant="subtle" 
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedCourse(null);
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

      {/* Stats Cards */}
      <Grid mb="lg">
        <Grid.Col span={4}>
          <Card shadow="sm" p="md" radius="md" withBorder>
            <Group gap="xs">
              <IconSchool size={20} color="#CC0000" />
              <Text size="sm" c="dimmed">Total Courses</Text>
            </Group>
            <Text size="xl" fw={700} mt="xs">{courses.length}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card shadow="sm" p="md" radius="md" withBorder>
            <Group gap="xs">
              <IconTrophy size={20} color="#CC0000" />
              <Text size="sm" c="dimmed">Total Credits</Text>
            </Group>
            <Text size="xl" fw={700} mt="xs">{getTotalCredits().toFixed(1)}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card shadow="sm" p="md" radius="md" withBorder>
            <Group gap="xs">
              <IconCertificate size={20} color="#CC0000" />
              <Text size="sm" c="dimmed">AP Courses</Text>
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {courses.filter(c => c.courseType === 'AP').length}
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Filter */}
      <Group mb="md">
        <Select
          label="Filter by Type"
          data={[
            { value: 'All', label: 'All Courses' },
            { value: 'AP', label: 'AP Courses' },
            { value: 'BU', label: 'BU Courses' },
            { value: 'Transfer', label: 'Transfer Courses' },
            { value: 'Other', label: 'Other' },
          ]}
          value={filterType}
          onChange={(value) => setFilterType(value as any)}
          style={{ width: 200 }}
        />
      </Group>

      {/* Courses List */}
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
                    <Badge color={getCourseTypeColor(course.courseType)} variant="light">
                      {course.courseType}
                    </Badge>
                    {course.grade && (
                      <Badge color="gray" variant="outline">
                        Grade: {course.grade}
                      </Badge>
                    )}
                    {course.credits && (
                      <Badge color="gray" variant="outline">
                        {course.credits} credits
                      </Badge>
                    )}
                  </Group>
                  <Title order={4} c="bu-red" mb="xs">
                    {course.courseCode}
                  </Title>
                  <Text fw={600} size="md" mb="xs">
                    {course.courseTitle}
                  </Text>
                  {course.semesterTaken && (
                    <Text size="sm" c="dimmed">
                      {course.semesterTaken}
                    </Text>
                  )}
                </Box>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="lg"
                  onClick={() => handleDelete(course.id, course.courseCode)}
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
    </Container>
  );
};

export default CompletedCoursesPage;
