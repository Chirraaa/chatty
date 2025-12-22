// components/chat-input.tsx
import { useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Input, Button, Spinner } from '@ui-kitten/components';
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

  const ImageIcon = (props: any) => (
    <Ionicons name="image-outline" size={20} color={sending ? '#8F9BB3' : '#3366FF'} />
  );

  const SendIcon = (props: any) => (
    sending ? (
      <Spinner size='small' status='control' />
    ) : (
      <Ionicons name="send" size={20} color="white" />
    )
  );

  return (
    <View style={styles.container}>
      <Button
        appearance='ghost'
        size='small'
        accessoryLeft={ImageIcon}
        onPress={handleSendImage}
        disabled={sending}
        style={styles.imageButton}
      />

      <Input
        style={styles.input}
        placeholder="Type a message..."
        value={inputText}
        onChangeText={setInputText}
        multiline
        textStyle={styles.inputText}
        disabled={sending}
        onSubmitEditing={handleSendText}
      />

      <Button
        size='small'
        accessoryLeft={SendIcon}
        onPress={handleSendText}
        disabled={!inputText.trim() || sending}
        style={styles.sendButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF1F7',
  },
  imageButton: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    marginRight: 8,
  },
  inputText: {
    minHeight: 20,
    maxHeight: 100,
  },
  sendButton: {
    borderRadius: 20,
    paddingHorizontal: 12,
  },
});