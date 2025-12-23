// components/chat-input.tsx
import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Input, Button } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import imageService from '@/services/image.service';
import messageService from '@/services/message.service';

interface ChatInputProps {
  receiverId: string;
  onSendComplete?: () => void;
}

export const ChatInput = ({ receiverId, onSendComplete }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (message.trim() && !sending) {
      const textToSend = message.trim();
      setMessage(''); // Clear input immediately for better UX
      
      try {
        setSending(true);
        await messageService.sendTextMessage(receiverId, textToSend);
        onSendComplete?.();
      } catch (error) {
        console.error('Error sending message:', error);
        // Optionally restore the message on error
        setMessage(textToSend);
      } finally {
        setSending(false);
      }
    }
  };

  const handlePickImage = async () => {
    if (sending) return;
    
    try {
      setSending(true);
      const uri = await imageService.selectImageSource();
      if (uri) {
        await messageService.sendImageMessage(receiverId, uri);
        onSendComplete?.();
      }
    } catch (error) {
      console.error('Error sending image:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        onPress={handlePickImage} 
        style={styles.iconButton}
        disabled={sending}
      >
        <Ionicons 
          name="add-circle-outline" 
          size={28} 
          color={sending ? "#8F9BB3" : "#3366FF"} 
        />
      </TouchableOpacity>

      <Input
        style={styles.input}
        placeholder="Type a message..."
        value={message}
        onChangeText={setMessage}
        multiline={true}
        disabled={sending}
      />

      <TouchableOpacity 
        onPress={handleSend}
        disabled={!message.trim() || sending}
        style={styles.sendButton}
      >
        <Ionicons 
          name="send" 
          size={24} 
          color={(!message.trim() || sending) ? "#8F9BB3" : "#3366FF"} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom:60,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E9F2',
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 20,
  },
  iconButton: {
    padding: 4,
  },
  sendButton: {
    padding: 4,
    paddingHorizontal: 8,
  },
});