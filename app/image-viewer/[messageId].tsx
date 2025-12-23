// app/image-viewer/[messageId].tsx - Full screen image viewer with save
import { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerScreen() {
  const { messageId, imageData } = useLocalSearchParams<{ 
    messageId: string;
    imageData: string;
  }>();
  const [saving, setSaving] = useState(false);

  const handleSaveImage = async () => {
    try {
      setSaving(true);

      // Request permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to save images to your device.'
        );
        return;
      }

      // Save image
      const filename = FileSystem.documentDirectory + `chatty_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(filename, imageData.split(',')[1], {
        encoding: FileSystem.EncodingType.Base64,
      });

      const asset = await MediaLibrary.createAssetAsync(filename);
      await MediaLibrary.createAlbumAsync('Chatty', asset, false);

      Alert.alert('Success', 'Image saved to gallery!');
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity 
            onPress={handleSaveImage} 
            style={styles.headerButton}
            disabled={saving}
          >
            <Ionicons 
              name={saving ? "hourglass" : "download"} 
              size={28} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageData }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerButton: {
    padding: 8,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 100,
  },
});