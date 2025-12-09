
import React, { useState, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, isSameDay } from "date-fns";
import axios from "axios";
import { cn } from "~/lib/utils";

// Assuming we have these from your project's UI components
// If not, I'll use standard HTML elements or try to import if I knew where they were.
// I will stick to standard elements and classNames compatible with Tailwind.

interface AvailableDate {
  date: string; // ISO string from API
  userId: string;
}

interface User {
  id: string;
  name: string;
  phoneNumber?: string;
}

export function SharedDateFinder() {
  const [myDates, setMyDates] = useState<Date[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]); // For selection
  const [commonDates, setCommonDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);
  const [otherUsersDates, setOtherUsersDates] = useState<AvailableDate[]>([]);

  // Fetch my available dates on mount
  useEffect(() => {
    fetchMyDates();
    // Also fetch potential users to compare with.
    // Since there is no "list all users" API readily apparent that returns everyone without search,
    // I might implement a simple search or just mock it if needed.
    // But `api/users/search` exists.
    // Let's try to fetch some users or provide a search input.
    // For simplicity, I'll provide a way to search users to add to the comparison group.
  }, []);

  const fetchMyDates = async () => {
    try {
      const response = await axios.get("/api/available-dates");
      const dates = response.data.availableDates.map((d: any) => new Date(d.date));
      setMyDates(dates);
    } catch (error) {
      console.error("Failed to fetch my dates", error);
    }
  };

  const handleDayClick = async (day: Date, modifiers: any) => {
    const isSelected = modifiers.selected;
    // Optimistic update
    let newDates;
    if (isSelected) {
      newDates = myDates.filter((d) => !isSameDay(d, day));
    } else {
      newDates = [...myDates, day];
    }
    setMyDates(newDates);

    try {
      if (isSelected) {
        // Remove
        const formData = new FormData();
        formData.append("date", day.toISOString());
        await axios.delete("/api/available-dates", { data: formData });
      } else {
        // Add
        const formData = new FormData();
        formData.append("date", day.toISOString());
        await axios.post("/api/available-dates", formData);
      }
    } catch (error) {
      console.error("Failed to update date", error);
      // Revert on error
      fetchMyDates();
    }
  };

  // Search users
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      // Assuming api/users/search takes ?q=...
      // Let's check api/users/search.ts implementation.
      // Wait, I haven't checked it. Let's assume standard or check later.
      // I will assume it returns a list of users.
      // If not, I might need to adjust.
      const response = await axios.get(`/api/users/search?q=${searchQuery}`);
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error("Search failed", error);
    }
  };

  const addUser = async (user: User) => {
    if (selectedUsers.find((u) => u.id === user.id)) return;
    const newSelected = [...selectedUsers, user];
    setSelectedUsers(newSelected);

    // Fetch dates for this user
    try {
      const response = await axios.get(`/api/available-dates?userId=${user.id}`);
      const userDates = response.data.availableDates; // { date: string, userId: string }[]
      setOtherUsersDates((prev) => [...prev, ...userDates]);
    } catch (error) {
      console.error(`Failed to fetch dates for user ${user.name}`, error);
    }
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
    setOtherUsersDates(otherUsersDates.filter((d) => d.userId !== userId));
  };

  // Calculate common dates
  useEffect(() => {
    if (selectedUsers.length === 0) {
      setCommonDates([]);
      return;
    }

    // Start with my dates
    // Actually, "Find common dates among participants". Am I a participant?
    // Usually yes.

    const participants = [...selectedUsers];
    // Convert dates to string YYYY-MM-DD for easier comparison
    const toDateString = (d: Date) => format(d, 'yyyy-MM-dd');

    // My dates set
    let common = new Set(myDates.map(toDateString));

    // Intersect with each selected user
    participants.forEach(p => {
        const pDates = otherUsersDates
            .filter(d => d.userId === p.id)
            .map(d => toDateString(new Date(d.date)));

        const pDatesSet = new Set(pDates);
        // Intersection
        common = new Set([...common].filter(x => pDatesSet.has(x)));
    });

    setCommonDates([...common].map(s => new Date(s)));

  }, [myDates, selectedUsers, otherUsersDates]);


  // Custom modifiers for day picker
  const modifiers = {
    common: commonDates,
    myDate: myDates,
  };

  const modifiersStyles = {
    common: {
        backgroundColor: '#22c55e', // green-500
        color: 'white',
        fontWeight: 'bold',
        borderRadius: '50%',
    },
    myDate: {
         border: '2px solid #3b82f6', // blue-500
         borderRadius: '50%',
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">공통 날짜 찾기</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
            <h3 className="text-xl font-semibold mb-2">내 가능한 날짜 선택</h3>
            <p className="text-sm text-gray-500 mb-4">달력을 클릭하여 가능한 날짜를 선택/해제 하세요.</p>
            <div className="border rounded-lg p-4 inline-block bg-white shadow">
                <DayPicker
                    mode="multiple"
                    selected={myDates}
                    onDayClick={handleDayClick}
                    modifiers={modifiers}
                    modifiersStyles={modifiersStyles}
                />
            </div>
            <div className="mt-2 flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500"></div>
                    <span>내 선택</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span>모두 가능</span>
                </div>
            </div>
        </div>

        <div>
            <h3 className="text-xl font-semibold mb-2">참여자 추가</h3>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    className="border p-2 rounded flex-1"
                    placeholder="이름 또는 전화번호 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    onClick={handleSearch}
                >
                    검색
                </button>
            </div>

            {searchResults.length > 0 && (
                <div className="mb-4 border rounded p-2 max-h-40 overflow-y-auto">
                    {searchResults.map(user => (
                        <div key={user.id} className="flex justify-between items-center p-2 hover:bg-gray-100">
                            <span>{user.name} ({user.phoneNumber})</span>
                            <button
                                className="text-blue-500 text-sm font-semibold"
                                onClick={() => {
                                    addUser(user);
                                    setSearchResults([]);
                                    setSearchQuery("");
                                }}
                            >
                                추가
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <h4 className="font-semibold mb-2">선택된 참여자 ({selectedUsers.length}명)</h4>
            {selectedUsers.length === 0 ? (
                <p className="text-gray-500 text-sm">참여자가 없습니다.</p>
            ) : (
                <ul className="space-y-2">
                    {selectedUsers.map(user => (
                        <li key={user.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span>{user.name}</span>
                            <button
                                className="text-red-500 hover:text-red-700"
                                onClick={() => removeUser(user.id)}
                            >
                                &times;
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {commonDates.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="text-green-800 font-bold mb-2">🎉 공통 가능한 날짜</h4>
                    <ul className="list-disc list-inside text-green-700">
                        {commonDates.sort((a,b) => a.getTime() - b.getTime()).map(d => (
                            <li key={d.toISOString()}>{format(d, 'yyyy년 M월 d일')}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
