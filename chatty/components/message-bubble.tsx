// components/message-bubble.tsx - With E2EE error handling
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
      {message.type === 'text' && message.content && (
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
            {message.content}
          </Text>
          {message.encrypted && !message.decryptionError && (
            <Text category='c2' style={styles.encryptedBadge}>
              🔒 Encrypted
            </Text>
          )}
          {message.decryptionError && (
            <Text category='c2' style={styles.errorHint}>
              Device keys changed. New messages will work.
            </Text>
          )}
        </Card>
      )}

      {message.type === 'image' && message.imageData && !message.decryptionError && (
        <Card style={styles.imageBubble}>
          <Image
            source={{ uri: message.imageData }}
            style={styles.image}
            resizeMode="cover"
          />
          {message.encrypted && (
            <View style={styles.imageEncryptedBadge}>
              <Text category='c2' style={styles.encryptedBadgeText}>
                🔒 Encrypted
              </Text>
            </View>
          )}
        </Card>
      )}

      {message.type === 'image' && message.decryptionError && (
        <Card style={[styles.bubble, styles.errorBubble]}>
          <Text style={styles.errorText}>
            🖼️ Encrypted image
          </Text>
          <Text category='c2' style={styles.errorHint}>
            Device keys changed. New images will work.
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
  encryptedBadge: {
    marginTop: 4,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
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
    position: 'relative',
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: 16,
  },
  imageEncryptedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  encryptedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
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