// app/(tabs)/chat.tsx
import { useState, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text } from 'react-native';
import messageService, { Message } from '@/services/message.service';
import { auth } from '@/config/firebase';

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const otherUserId = 'OTHER_USER_ID'; // Get from navigation or state

  useEffect(() => {
    const unsubscribe = messageService.subscribeToMessages(otherUserId, setMessages);
    return unsubscribe;
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    await messageService.sendTextMessage(otherUserId, inputText);
    setInputText('');
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={messages}
        className="flex-1 px-4"
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className={`my-2 p-3 rounded-2xl max-w-[80%] ${
            item.senderId === auth().currentUser?.uid 
              ? 'bg-blue-500 self-end' 
              : 'bg-gray-200 dark:bg-gray-700 self-start'
          }`}>
            <Text className={item.senderId === auth().currentUser?.uid ? 'text-white' : 'text-black dark:text-white'}>
              {item.decryptedContent}
            </Text>
          </View>
        )}
      />
      
      <View className="flex-row items-center p-4 border-t border-gray-200 dark:border-gray-700">
        <TextInput
          className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 mr-2"
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
        />
        <TouchableOpacity onPress={sendMessage} className="bg-blue-500 rounded-full p-3">
          <Text className="text-white font-semibold">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}