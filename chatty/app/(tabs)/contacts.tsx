// app/(tabs)/contacts.tsx
import { useState } from 'react';
import {
    View,
    TextInput,
    FlatList,
    TouchableOpacity,
    Text,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import authService from '@/services/auth.service';
import { auth } from '@/config/firebase';

interface User {
    id: string;
    username: string;
    email: string;
}

export default function ContactsScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            setLoading(true);
            const results = await authService.searchUsers(searchQuery.trim());

            // Filter out current user
            const currentUserId = auth().currentUser?.uid;
            const filtered = results
                .filter((user: any) => user.id !== currentUserId)
                .map((user: any) => ({
                    id: user.id,
                    username: user.username || 'Unknown',
                    email: user.email || '',
                })) as User[];

            setSearchResults(filtered);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (user: User) => {
        // Navigate to chat with this user
        router.push(`/chat/${user.id}`);
    };

    return (
        <View className="flex-1 bg-white dark:bg-gray-900">
            {/* Header */}
            <View className="p-4 border-b border-gray-200 dark:border-gray-700">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                    Find Contact
                </Text>
            </View>

            {/* Search Bar */}
            <View className="p-4 flex-row gap-2">
                <View className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-3 flex-row items-center">
                    <Ionicons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-2 text-black dark:text-white text-base"
                        placeholder="Search by username..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                </View>
                <TouchableOpacity
                    className="bg-blue-500 rounded-full px-6 justify-center"
                    onPress={handleSearch}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text className="text-white font-semibold">Search</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 ? (
                <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700"
                            onPress={() => handleSelectUser(item)}
                        >
                            {/* Avatar */}
                            <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3">
                                <Text className="text-white text-xl font-bold">
                                    {item.username.charAt(0).toUpperCase()}
                                </Text>
                            </View>

                            {/* User Info */}
                            <View className="flex-1">
                                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                                    {item.username}
                                </Text>
                                <Text className="text-sm text-gray-600 dark:text-gray-400">
                                    {item.email}
                                </Text>
                            </View>

                            {/* Arrow */}
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            ) : (
                <View className="flex-1 items-center justify-center px-8">
                    <Ionicons name="people-outline" size={64} color="#9CA3AF" />
                    <Text className="text-gray-600 dark:text-gray-400 text-center mt-4 text-base">
                        {searchQuery
                            ? 'No users found. Try a different username.'
                            : 'Search for a username to start chatting'}
                    </Text>
                </View>
            )}
        </View>
    );
}