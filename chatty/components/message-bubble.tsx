// components/message-bubble.tsx
import { StyleSheet, View, Image } from 'react-native';
import { Text, Card } from '@ui-kitten/components';
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
      style={[
        styles.container,
        isSentByMe ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      {/* Message Content */}
      {message.type === 'text' && message.decryptedContent && (
        <Card
          style={[
            styles.bubble,
            isSentByMe ? styles.sentBubble : styles.receivedBubble,
            message.decryptionError && styles.errorBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isSentByMe ? styles.sentText : styles.receivedText,
              message.decryptionError && styles.errorText,
            ]}
          >
            {message.decryptedContent}
          </Text>
          {message.decryptionError && (
            <Text category='c2' style={styles.errorHint}>
              Old encryption keys • Go to Profile → Reset Keys
            </Text>
          )}
        </Card>
      )}

      {message.type === 'image' && message.decryptedImageUri && !message.decryptionError && (
        <Card style={styles.imageBubble}>
          <Image
            source={{ uri: message.decryptedImageUri }}
            style={styles.image}
            resizeMode="cover"
          />
        </Card>
      )}

      {message.type === 'image' && message.decryptionError && (
        <Card style={[styles.bubble, styles.errorBubble]}>
          <Text style={styles.errorText}>
            🖼️ Image encrypted with old keys
          </Text>
          <Text category='c2' style={styles.errorHint}>
            Go to Profile → Reset Keys
          </Text>
        </Card>
      )}

      {/* Timestamp */}
      <Text
        category='c1'
        appearance='hint'
        style={[
          styles.timestamp,
          isSentByMe ? styles.sentTimestamp : styles.receivedTimestamp,
        ]}
      >
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
    maxWidth: '80%',
  },
  sentContainer: {
    alignSelf: 'flex-end',
  },
  receivedContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
  },
  sentBubble: {
    backgroundColor: '#3366FF',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#EDF1F7',
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    backgroundColor: '#FFE5E5',
    borderColor: '#FF3D71',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#222B45',
  },
  errorText: {
    color: '#FF3D71',
  },
  errorHint: {
    marginTop: 4,
    color: '#8F9BB3',
    fontSize: 10,
    fontStyle: 'italic',
  },
  imageBubble: {
    padding: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: 16,
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
  },
  sentTimestamp: {
    textAlign: 'right',
  },
  receivedTimestamp: {
    textAlign: 'left',
  },
});