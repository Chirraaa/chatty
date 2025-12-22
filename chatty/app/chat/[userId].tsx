// app/chat/[userId].tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChatInput } from '@/components/chat-input';
import { MessageBubble } from '@/components/message-bubble';
import messageService, { Message } from '@/services/message.service';
import authService from '@/services/auth.service';
import callService from '@/services/call.service';

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [customNickname, setCustomNickname] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId) return;

    loadUserProfile();
    
    // Subscribe to messages
    const unsubscribe = messageService.subscribeToMessages(
      userId,
      (newMessages) => {
        setMessages(newMessages);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      const profile = await authService.getUserProfile(userId);
      setUserProfile(profile);
      
      const nickname = await authService.getCustomNickname(userId);
      setCustomNickname(nickname);
      setNicknameInput(nickname || profile?.username || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveNickname = async () => {
    try {
      await authService.setCustomNickname(userId, nicknameInput.trim());
      setCustomNickname(nicknameInput.trim());
      setEditingNickname(false);
      Alert.alert('Success', 'Custom nickname saved!');
    } catch (error) {
      console.error('Error saving nickname:', error);
      Alert.alert('Error', 'Failed to save nickname');
    }
  };

  const handleVoiceCall = async () => {
    try {
      const callId = await callService.createCall(userId, false);
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error('Error starting voice call:', error);
      Alert.alert('Call Failed', 'Unable to start voice call');
    }
  };

  const handleVideoCall = async () => {
    try {
      const callId = await callService.createCall(userId, true);
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Call Failed', 'Unable to start video call');
    }
  };

  const displayName = customNickname || userProfile?.username || 'Chat';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
              <Text className="text-blue-500 text-base ml-1">Back</Text>
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <TouchableOpacity
              onPress={() => setEditingNickname(true)}
              className="items-center"
            >
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {displayName}
              </Text>
              {customNickname && (
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  @{userProfile?.username}
                </Text>
              )}
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View className="flex-row gap-2">
              <TouchableOpacity onPress={handleVoiceCall} className="p-2">
                <Ionicons name="call" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleVideoCall} className="p-2">
                <Ionicons name="videocam" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingNickname(true)} className="p-2">
                <Ionicons name="create-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white dark:bg-gray-900"
        keyboardVerticalOffset={100}
      >
        {/* Nickname Editor Modal */}
        {editingNickname && (
          <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 z-50 items-center justify-center">
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 mx-8 w-80">
              <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Set Custom Nickname
              </Text>
              
              <TextInput
                className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-black dark:text-white mb-4"
                placeholder="Enter nickname..."
                placeholderTextColor="#9CA3AF"
                value={nicknameInput}
                onChangeText={setNicknameInput}
                autoFocus
              />

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-xl py-3"
                  onPress={() => {
                    setEditingNickname(false);
                    setNicknameInput(customNickname || userProfile?.username || '');
                  }}
                >
                  <Text className="text-center font-semibold text-gray-900 dark:text-white">
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  className="flex-1 bg-blue-500 rounded-xl py-3"
                  onPress={handleSaveNickname}
                >
                  <Text className="text-center font-semibold text-white">
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Input */}
        <ChatInput
          receiverId={userId}
          onSendComplete={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
        />
      </KeyboardAvoidingView>
    </>
  );
}