// app/(tabs)/index.tsx
import { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';
import { Ionicons } from '@expo/vector-icons';

interface ChatPreview {
  userId: string;
  username: string;
  customNickname?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export default function ChatsListScreen() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Get all messages involving current user
      const unsubscribe = firestore()
        .collection('messages')
        .where('senderId', '==', currentUser.uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot(async (snapshot) => {
          const receiverSnapshot = await firestore()
            .collection('messages')
            .where('receiverId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

          // Combine both queries
          const allDocs = [...snapshot.docs, ...receiverSnapshot.docs];
          
          // Get unique user IDs
          const userIds = new Set<string>();
          allDocs.forEach(doc => {
            const data = doc.data();
            if (data.senderId !== currentUser.uid) {
              userIds.add(data.senderId);
            }
            if (data.receiverId !== currentUser.uid) {
              userIds.add(data.receiverId);
            }
          });

          // Load user profiles and custom nicknames
          const chatPreviews: ChatPreview[] = [];
          for (const userId of userIds) {
            const profile = await authService.getUserProfile(userId);
            const customNickname = await authService.getCustomNickname(userId);
            
            if (profile) {
              chatPreviews.push({
                userId,
                username: profile.username,
                customNickname: customNickname || undefined,
                unreadCount: 0, // TODO: Implement unread counter
              });
            }
          }

          setChats(chatPreviews);
          setLoading(false);
        });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading chats:', error);
      setLoading(false);
    }
  };

  const handleChatPress = (userId: string) => {
    router.push(`/chat/${userId}`);
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Chats
        </Text>
      </View>

      {/* Chats List */}
      {chats.length > 0 ? (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700"
              onPress={() => handleChatPress(item.userId)}
            >
              {/* Avatar */}
              <View className="w-14 h-14 bg-blue-500 rounded-full items-center justify-center mr-3">
                <Text className="text-white text-xl font-bold">
                  {(item.customNickname || item.username).charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Chat Info */}
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">
                    {item.customNickname || item.username}
                  </Text>
                  {item.lastMessageTime && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {item.lastMessageTime.toLocaleDateString()}
                    </Text>
                  )}
                </View>
                {item.customNickname && (
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    @{item.username}
                  </Text>
                )}
              </View>

              {/* Arrow */}
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
          <Text className="text-gray-600 dark:text-gray-400 text-center mt-4 text-base">
            No conversations yet
          </Text>
          <Text className="text-gray-500 dark:text-gray-500 text-center mt-2 text-sm">
            Go to Contacts to find someone to chat with
          </Text>
        </View>
      )}
    </View>
  );
}