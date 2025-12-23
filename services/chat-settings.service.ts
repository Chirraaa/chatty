// services/chat-settings.service.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/config/firebase';

export interface ChatSettings {
  backgroundColor: string;
}

class ChatSettingsService {
  private async getStorageKey(otherUserId: string): Promise<string> {
    const currentUser = auth().currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    return `chat_settings_${currentUser.uid}_${otherUserId}`;
  }

  async getChatSettings(otherUserId: string): Promise<ChatSettings> {
    try {
      const key = await this.getStorageKey(otherUserId);
      const stored = await AsyncStorage.getItem(key);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Default settings
      return {
        backgroundColor: '#1A1A1A', // Dark background
      };
    } catch (error) {
      console.error('Error getting chat settings:', error);
      return { backgroundColor: '#1A1A1A' };
    }
  }

  async setChatBackgroundColor(otherUserId: string, color: string): Promise<void> {
    try {
      const key = await this.getStorageKey(otherUserId);
      const settings = await this.getChatSettings(otherUserId);
      settings.backgroundColor = color;
      await AsyncStorage.setItem(key, JSON.stringify(settings));
    } catch (error) {
      console.error('Error setting chat background color:', error);
      throw error;
    }
  }
}

export default new ChatSettingsService();