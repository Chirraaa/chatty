// app/(tabs)/contacts.tsx - Clean contacts screen
import { useState } from 'react';
import { StyleSheet, FlatList, View, TouchableOpacity, Image, TextInput, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Text, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import authService from '@/services/auth.service';
import { auth } from '@/config/firebase';

interface User {
    id: string;
    username: string;
    email: string;
    profilePicture?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ContactsScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setHasSearched(false);
            return;
        }

        try {
            setLoading(true);
            setHasSearched(true);
            const results = await authService.searchUsers(searchQuery.trim());

            const currentUserId = auth().currentUser?.uid;
            const filtered = results
                .filter((user: any) => user.id !== currentUserId)
                .map((user: any) => ({
                    id: user.id,
                    username: user.username || 'Unknown',
                    email: user.email || '',
                    profilePicture: user.profilePicture,
                })) as User[];

            setSearchResults(filtered);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (user: User) => {
        router.push(`/chat/${user.id}`);
    };

    const renderUserItem = ({ item }: { item: User }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleSelectUser(item)}
            activeOpacity={0.7}
        >
            {item.profilePicture ? (
                <Image
                    source={{ uri: `data:image/jpeg;base64,${item.profilePicture}` }}
                    style={styles.avatar}
                />
            ) : (
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                        {item.username.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}

            <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.email}>{item.email}</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#AAB8C2" />
        </TouchableOpacity>
    );

    const renderEmptyState = () => {
        if (loading) return null;
        
        if (!hasSearched) {
            return (
                <View style={styles.emptyState}>
                    <Ionicons name="search" size={80} color="#E1E8ED" />
                    <Text style={styles.emptyTitle}>Find people to chat with</Text>
                    <Text style={styles.emptySubtitle}>
                        Search by username to start a conversation
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={80} color="#E1E8ED" />
                <Text style={styles.emptyTitle}>No users found</Text>
                <Text style={styles.emptySubtitle}>
                    Try searching for a different username
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>Contacts</Text>
            </LinearGradient>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#657786" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by username..."
                        placeholderTextColor="#AAB8C2"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {loading && (
                        <Spinner size='small' />
                    )}
                </View>
            </View>

            {searchResults.length > 0 ? (
                <FlatList
                    data={searchResults}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                renderEmptyState()
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F9FA',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    searchContainer: {
        padding: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#14171A',
    },
    listContent: {
        paddingTop: 8,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
        marginBottom: 1,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    avatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#667eea',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#14171A',
        marginBottom: 2,
    },
    email: {
        fontSize: 14,
        color: '#657786',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#14171A',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#657786',
        textAlign: 'center',
        lineHeight: 20,
    },
});