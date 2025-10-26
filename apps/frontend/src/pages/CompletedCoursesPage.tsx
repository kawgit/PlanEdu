import React, { useEffect, useState } from 'react';
import { isUserLoggedIn, fetchCompletedCourses, deleteCompletedCourse, addCompletedCourse, CompletedCourse } from '../utils/auth';
import TranscriptUpload from '../components/TranscriptUpload';

const CompletedCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'All' | 'AP' | 'BU' | 'Transfer' | 'Other'>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    courseCode: '',
    courseTitle: '',
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

  const handleDelete = async (courseId: number) => {
    if (!confirm('Are you sure you want to delete this course?')) {
      return;
    }

    try {
      await deleteCompletedCourse(courseId);
      await loadCourses();
    } catch (err: any) {
      alert(err.message || 'Failed to delete course');
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.courseCode || !formData.courseTitle) {
      alert('Course code and title are required');
      return;
    }

    try {
      await addCompletedCourse({
        courseCode: formData.courseCode,
        courseTitle: formData.courseTitle,
        grade: formData.grade || undefined,
        credits: formData.credits ? parseFloat(formData.credits) : undefined,
        semesterTaken: formData.semesterTaken || undefined,
        courseType: formData.courseType,
      });

      setFormData({
        courseCode: '',
        courseTitle: '',
        grade: '',
        credits: '',
        semesterTaken: '',
        courseType: 'BU',
      });
      setShowAddForm(false);
      await loadCourses();
    } catch (err: any) {
      alert(err.message || 'Failed to add course');
    }
  };

  const getCourseTypeColor = (type: string) => {
    switch (type) {
      case 'AP': return 'bg-purple-100 text-purple-800';
      case 'BU': return 'bg-blue-100 text-blue-800';
      case 'Transfer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Please sign in</h2>
          <p className="text-gray-600">You need to sign in to view your completed courses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Completed Courses</h1>
          <p className="text-gray-600 mt-2">
            Manage courses you've already completed, including AP courses and BU courses.
          </p>
        </div>

        {/* Upload Transcript Section */}
        <div className="mb-8">
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            {showUploadForm ? 'Hide Upload Form' : 'Upload Transcript'}
          </button>

          {showUploadForm && (
            <div className="mt-4">
              <TranscriptUpload onUploadSuccess={loadCourses} />
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Total Courses</p>
            <p className="text-2xl font-bold text-gray-900">{courses.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">Total Credits</p>
            <p className="text-2xl font-bold text-gray-900">{getTotalCredits().toFixed(1)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-sm">AP Courses</p>
            <p className="text-2xl font-bold text-gray-900">
              {courses.filter(c => c.courseType === 'AP').length}
            </p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              >
                <option value="All">All Courses</option>
                <option value="AP">AP Courses</option>
                <option value="BU">BU Courses</option>
                <option value="Transfer">Transfer Courses</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              {showAddForm ? 'Cancel' : 'Add Course Manually'}
            </button>
          </div>

          {/* Add Course Form */}
          {showAddForm && (
            <form onSubmit={handleAddCourse} className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    value={formData.courseCode}
                    onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                    placeholder="e.g., CAS CS 111 or AP Calculus BC"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    value={formData.courseTitle}
                    onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
                    placeholder="e.g., Introduction to Computer Science"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Type *
                  </label>
                  <select
                    value={formData.courseType}
                    onChange={(e) => setFormData({ ...formData, courseType: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="BU">BU Course</option>
                    <option value="AP">AP Course</option>
                    <option value="Transfer">Transfer Course</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade
                  </label>
                  <input
                    type="text"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    placeholder="e.g., A, B+, or 5 for AP"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credits
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                    placeholder="e.g., 4"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Semester Taken
                  </label>
                  <input
                    type="text"
                    value={formData.semesterTaken}
                    onChange={(e) => setFormData({ ...formData, semesterTaken: e.target.value })}
                    placeholder="e.g., Fall 2023"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Course
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Courses List */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading courses...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p>{error}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">No completed courses yet.</p>
            <p className="text-sm text-gray-500">
              Upload your transcript or add courses manually to get started.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Semester
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{course.courseCode}</p>
                        <p className="text-sm text-gray-500">{course.courseTitle}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCourseTypeColor(course.courseType)}`}>
                        {course.courseType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.grade || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.credits || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.semesterTaken || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(course.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletedCoursesPage;

