// components/message-bubble.tsx
import { View, Text, Image } from 'react-native';
import { auth } from '@/config/firebase';
import { Message } from '@/services/message.service';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const currentUserId = auth().currentUser?.uid;
  const isSentByMe = message.senderId === currentUserId;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <View
      className={`mx-4 my-1 max-w-[80%] ${
        isSentByMe ? 'self-end' : 'self-start'
      }`}
    >
      {/* Message Content */}
      {message.type === 'text' && message.decryptedContent && (
        <View
          className={`p-3 rounded-2xl ${
            isSentByMe
              ? 'bg-blue-500 rounded-br-sm'
              : 'bg-gray-200 dark:bg-gray-700 rounded-bl-sm'
          }`}
        >
          <Text
            className={`text-base ${
              isSentByMe ? 'text-white' : 'text-black dark:text-white'
            }`}
          >
            {message.decryptedContent}
          </Text>
        </View>
      )}

      {message.type === 'image' && message.decryptedImageUri && (
        <View
          className={`rounded-2xl overflow-hidden ${
            isSentByMe ? 'rounded-br-sm' : 'rounded-bl-sm'
          }`}
        >
          <Image
            source={{ uri: message.decryptedImageUri }}
            className="w-64 h-64"
            resizeMode="cover"
          />
        </View>
      )}

      {/* Timestamp */}
      <Text
        className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
          isSentByMe ? 'text-right' : 'text-left'
        }`}
      >
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}