// app/(tabs)/contacts.tsx
import { useState } from 'react';
import { StyleSheet, FlatList, View, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Layout, Text, Input, Button, Spinner, List, ListItem } from '@ui-kitten/components';
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
            Alert.alert('Error', 'Failed to search users');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (user: User) => {
        router.push(`/chat/${user.id}`);
    };

    const renderUserItem = ({ item }: { item: User }) => (
        <ListItem
            onPress={() => handleSelectUser(item)}
            title={item.username}
            description={item.email}
            accessoryLeft={() => (
                <View style={styles.avatar}>
                    <Text category='h6' style={styles.avatarText}>
                        {item.username.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}
            accessoryRight={() => (
                <Ionicons name="chevron-forward" size={20} color="#8F9BB3" />
            )}
        />
    );

    return (
        <Layout style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text category='h4'>Find Contact</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Input
                    style={styles.searchInput}
                    placeholder='Search by username...'
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    accessoryLeft={() => (
                        <Ionicons name="search" size={20} color="#8F9BB3" />
                    )}
                />
                <Button
                    style={styles.searchButton}
                    onPress={handleSearch}
                    disabled={loading}
                >
                    {loading ? <Spinner size='small' status='control' /> : 'Search'}
                </Button>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 ? (
                <List
                    data={searchResults}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.id}
                />
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={64} color="#8F9BB3" />
                    <Text category='s1' appearance='hint' style={styles.emptyText}>
                        {searchQuery
                            ? 'No users found. Try a different username.'
                            : 'Search for a username to start chatting'}
                    </Text>
                </View>
            )}
        </Layout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 20,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF1F7',
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
    },
    searchInput: {
        flex: 1,
    },
    searchButton: {
        minWidth: 80,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#3366FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#FFFFFF',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyText: {
        marginTop: 16,
        textAlign: 'center',
    },
});