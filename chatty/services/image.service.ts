import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

class ImageService {
  // Check if image is too large for Firestore (max 1MB after encryption)
  private MAX_BASE64_SIZE = 700000; // 700KB to leave room for encryption overhead

  /**
   * Compress image to fit within Firestore limits
   */
  async compressImage(uri: string, quality = 0.7): Promise<string> {
    try {
      // First resize to reasonable dimensions
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1000 } }], // Max width 1000px
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Check size
      const base64 = await this.getBase64(manipulated.uri);
      const sizeInBytes = base64.length;

      console.log(`Image size: ${(sizeInBytes / 1024).toFixed(2)}KB`);

      // If still too large, compress more aggressively
      if (sizeInBytes > this.MAX_BASE64_SIZE && quality > 0.3) {
        console.log('Image too large, compressing more...');
        return this.compressImage(uri, quality - 0.2);
      }

      if (sizeInBytes > this.MAX_BASE64_SIZE) {
        throw new Error('Image too large even after compression. Try a smaller image.');
      }

      return manipulated.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  }

  /**
   * Convert image URI to base64 string
   */
  async getBase64(uri: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Remove the data:image/jpeg;base64, prefix
          const base64 = base64data.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting to base64:', error);
      throw error;
    }
  }

  /**
   * Pick image from gallery
   */
  async pickImage(): Promise<string | null> {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to share images.'
        );
        return null;
      }

      // Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) {
        return null;
      }

      // Compress the selected image
      const compressedUri = await this.compressImage(result.assets[0].uri);
      return compressedUri;
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      return null;
    }
  }

  /**
   * Take photo with camera
   */
  async takePhoto(): Promise<string | null> {
    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow camera access to take photos.'
        );
        return null;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) {
        return null;
      }

      // Compress the photo
      const compressedUri = await this.compressImage(result.assets[0].uri);
      return compressedUri;
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      return null;
    }
  }

  /**
   * Show action sheet to choose between camera and gallery
   */
  async selectImageSource(): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.alert(
        'Select Image',
        'Choose an option',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const uri = await this.takePhoto();
              resolve(uri);
            },
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const uri = await this.pickImage();
              resolve(uri);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(null),
          },
        ],
        { cancelable: true }
      );
    });
  }
}

export default new ImageService();