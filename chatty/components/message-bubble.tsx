// components/message-bubble.tsx - Simplified (no decryption)
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
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isSentByMe ? styles.sentText : styles.receivedText,
            ]}
          >
            {message.content}
          </Text>
        </Card>
      )}

      {message.type === 'image' && message.imageData && (
        <Card style={styles.imageBubble}>
          <Image
            source={{ uri: message.imageData }}
            style={styles.image}
            resizeMode="cover"
          />
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