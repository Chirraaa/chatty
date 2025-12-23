// services/profile-picture.service.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import { Alert } from 'react-native';

class ProfilePictureService {
  private MAX_SIZE = 300000; // 300KB

  /**
   * Compress and resize profile picture
   */
  async compressProfilePicture(uri: string): Promise<string> {
    try {
      // Resize to 400x400 square
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Get base64
      const response = await fetch(manipulated.uri);
      const blob = await response.blob();
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Check size
      if (base64.length > this.MAX_SIZE && manipulated.uri !== uri) {
        // Try again with lower quality
        return this.compressProfilePicture(uri);
      }

      return base64;
    } catch (error) {
      console.error('Error compressing profile picture:', error);
      throw error;
    }
  }

  /**
   * Pick and upload profile picture
   */
  async pickProfilePicture(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return null;
      }

      const base64 = await this.compressProfilePicture(result.assets[0].uri);
      return base64;
    } catch (error) {
      console.error('Error picking profile picture:', error);
      Alert.alert('Error', 'Failed to pick image');
      return null;
    }
  }

  /**
   * Upload profile picture to Firebase
   */
  async uploadProfilePicture(base64: string): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({
          profilePicture: base64,
          profilePictureUpdatedAt: firestore.FieldValue.serverTimestamp(),
        });

      console.log('✅ Profile picture uploaded');
    } catch (error) {
      console.error('❌ Error uploading profile picture:', error);
      throw error;
    }
  }

  /**
   * Remove profile picture
   */
  async removeProfilePicture(): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({
          profilePicture: firestore.FieldValue.delete(),
          profilePictureUpdatedAt: firestore.FieldValue.serverTimestamp(),
        });

      console.log('✅ Profile picture removed');
    } catch (error) {
      console.error('❌ Error removing profile picture:', error);
      throw error;
    }
  }
}

export default new ProfilePictureService();