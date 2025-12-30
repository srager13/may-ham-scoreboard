import React, { useState } from 'react';
import { Search, Save, CheckCircle, XCircle, Loader, MapPin, RefreshCw } from 'lucide-react';
import { apiClient, GolfCourseSearchResult, GolfCourse } from '../services/api';

const AdminPortal: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GolfCourseSearchResult[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null); // Store the ID of the course being updated
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [storedCourses, setStoredCourses] = useState<GolfCourse[]>([]);

  React.useEffect(() => {
    loadStoredCourses();
  }, []);

  const loadStoredCourses = async () => {
    try {
      const courses = await apiClient.getStoredGolfCourses();
      setStoredCourses(courses || []);
    } catch (error) {
      console.error('Failed to load stored courses:', error);
      setStoredCourses([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSaveStatus(null);
    setSelectedCourse(null);

    try {
      const results = await apiClient.searchGolfCourses(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSaveStatus({ success: false, message: 'Search failed. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCourse = async (course: GolfCourseSearchResult) => {
    try {
      const details = await apiClient.getGolfCourseDetails(course.id);
      setSelectedCourse(details.course);
    } catch (error) {
      console.error('Failed to fetch course details:', error);
      setSaveStatus({ success: false, message: 'Failed to load course details.' });
    }
  };

  const handleSaveCourse = async () => {
    if (!selectedCourse) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      await apiClient.saveGolfCourse(selectedCourse.id);
      setSaveStatus({ success: true, message: 'Golf course saved successfully!' });
      await loadStoredCourses();
      // Clear selection after save
      setSelectedCourse(null);
      setSearchResults([]);
      setSearchQuery('');
    } catch (error: any) {
      console.error('Failed to save course:', error);
      setSaveStatus({ 
        success: false, 
        message: error.message || 'Failed to save golf course. Please try again.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCourse = async (course: GolfCourse) => {
    if (!course.external_id) {
      setSaveStatus({ 
        success: false, 
        message: 'Cannot update course: missing external ID' 
      });
      return;
    }

    setIsUpdating(course.id);
    setSaveStatus(null);

    try {
      // Re-fetch and save the course using the external ID
      await apiClient.saveGolfCourse(course.external_id);
      setSaveStatus({ 
        success: true, 
        message: `${course.club_name} updated successfully!` 
      });
      await loadStoredCourses();
    } catch (error: any) {
      console.error('Failed to update course:', error);
      setSaveStatus({ 
        success: false, 
        message: error.message || `Failed to update ${course.club_name}. Please try again.` 
      });
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Portal</h1>
        <p className="text-gray-600">Manage golf courses and system settings</p>
      </div>

      {/* Golf Course Management Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Golf Course Management</h2>

        {/* Search Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search for Golf Course
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter course name (e.g., Tidewater)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {saveStatus && (
          <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${
            saveStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {saveStatus.success ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            {saveStatus.message}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedCourse && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Search Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleSelectCourse(course)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
                >
                  <h4 className="font-semibold text-gray-900">{course.club_name}</h4>
                  <p className="text-sm text-gray-600">{course.course_name}</p>
                  <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                    <MapPin className="h-4 w-4" />
                    {course.location.city}, {course.location.state}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Course Details */}
        {selectedCourse && (
          <div className="mb-6 border border-blue-200 rounded-lg p-6 bg-blue-50">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedCourse.club_name}</h3>
                <p className="text-gray-600">{selectedCourse.course_name}</p>
                <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  {selectedCourse.location.address}
                </div>
                <p className="text-sm text-gray-600">
                  {selectedCourse.location.city}, {selectedCourse.location.state} {selectedCourse.location.country}
                </p>
              </div>
              <button
                onClick={handleSaveCourse}
                disabled={isSaving}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Save Course
                  </>
                )}
              </button>
            </div>

            {/* Tees Information */}
            {selectedCourse.tees && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Available Tees</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Male Tees</p>
                    <div className="space-y-1">
                      {selectedCourse.tees.male?.map((tee: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-600">
                          {tee.tee_name} - {tee.total_yards} yards (Rating: {tee.course_rating}, Slope: {tee.slope_rating})
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Female Tees</p>
                    <div className="space-y-1">
                      {selectedCourse.tees.female?.map((tee: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-600">
                          {tee.tee_name} - {tee.total_yards} yards (Rating: {tee.course_rating}, Slope: {tee.slope_rating})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stored Courses Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Stored Golf Courses</h2>
        {!storedCourses || storedCourses.length === 0 ? (
          <p className="text-gray-500">No golf courses saved yet. Use the search above to add courses.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storedCourses.map((course) => (
              <div key={course.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <h4 className="font-semibold text-gray-900">{course.club_name}</h4>
                <p className="text-sm text-gray-600">{course.course_name}</p>
                <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" />
                  {course.city}, {course.state}
                </div>
                {course.external_id && (
                  <button
                    onClick={() => handleUpdateCourse(course)}
                    disabled={isUpdating === course.id}
                    className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm"
                  >
                    {isUpdating === course.id ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Update from API
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPortal;
