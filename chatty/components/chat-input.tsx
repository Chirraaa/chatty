// components/chat-input.tsx

import React, { useState } from 'react';

import { StyleSheet, View, TouchableOpacity } from 'react-native';

import { Input, Button, Icon } from '@ui-kitten/components';

import { Ionicons } from '@expo/vector-icons';

import imageService from '@/services/image.service';



interface ChatInputProps {

    receiverId: string;

    onSend: (text: string) => void;

    onImageSend: (uri: string) => void;

}



export const ChatInput = ({ onSend, onImageSend }: ChatInputProps) => {

    const [message, setMessage] = useState('');



    const handleSend = () => {

        if (message.trim()) {

            const textToSend = message.trim();

            setMessage(''); // Clear input immediately

            onSend(textToSend); // Trigger optimistic update in parent

        }

    };



    const handlePickImage = async () => {

        const uri = await imageService.selectImageSource();

        if (uri) {

            onImageSend(uri); // Trigger optimistic image update in parent

        }

    };



    return (

        <View style={styles.container}>

            <TouchableOpacity onPress={handlePickImage} style={styles.iconButton}>

                <Ionicons name="add-circle-outline" size={28} color="#3366FF" />

            </TouchableOpacity>


            <Input

                style={styles.input}

                placeholder="Type a message..."

                value={message}

                onChangeText={setMessage}

                multiline={true}

            />



            <Button

                style={styles.sendButton}

                appearance="ghost"

                status="primary"

                accessoryLeft={(props) => <Icon {...props} name="paper-plane" />}

                onPress={handleSend}

                disabled={!message.trim()}

            />

        </View>

    );

};



const styles = StyleSheet.create({

    container: {

        flexDirection: 'row',

        alignItems: 'center',

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

        paddingHorizontal: 0,

        paddingVertical: 0,

    },

});