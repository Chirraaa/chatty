// components/chat-input.tsx
import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import messageService from '@/services/message.service';
import imageService from '@/services/image.service';

interface ChatInputProps {
  receiverId: string;
  onSendComplete?: () => void;
}

export function ChatInput({ receiverId, onSendComplete }: ChatInputProps) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendText = async () => {
    if (!inputText.trim() || sending) return;

    try {
      setSending(true);
      await messageService.sendTextMessage(receiverId, inputText.trim());
      setInputText('');
      onSendComplete?.();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async () => {
    if (sending) return;

    try {
      setSending(true);
      const imageUri = await imageService.selectImageSource();
      
      if (imageUri) {
        await messageService.sendImageMessage(receiverId, imageUri);
        onSendComplete?.();
      }
    } catch (error) {
      console.error('Error sending image:', error);
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="flex-row items-center p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Image Button */}
      <TouchableOpacity
        onPress={handleSendImage}
        disabled={sending}
        className="mr-2 p-2"
      >
        <Ionicons 
          name="image" 
          size={24} 
          color={sending ? '#9CA3AF' : '#3B82F6'} 
        />
      </TouchableOpacity>

      {/* Text Input */}
      <TextInput
        className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 text-black dark:text-white"
        placeholder="Type a message..."
        placeholderTextColor="#9CA3AF"
        value={inputText}
        onChangeText={setInputText}
        multiline
        maxLength={5000}
        editable={!sending}
        onSubmitEditing={handleSendText}
      />

      {/* Send Button */}
      <TouchableOpacity
        onPress={handleSendText}
        disabled={!inputText.trim() || sending}
        className={`ml-2 p-3 rounded-full ${
          inputText.trim() && !sending ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        {sending ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Ionicons name="send" size={20} color="white" />
        )}
      </TouchableOpacity>
    </View>
  );
}