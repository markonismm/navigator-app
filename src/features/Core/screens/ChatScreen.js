import { faAngleLeft, faEdit, faPaperPlane, faTrash, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { useNavigation } from '@react-navigation/native';
import { useDriver, useFleetbase, useMountedState } from 'hooks';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';
import RNFS from 'react-native-fs';
import { Actions, Bubble, GiftedChat, InputToolbar, Send } from 'react-native-gifted-chat';
import { launchImageLibrary } from 'react-native-image-picker';
import Modal from 'react-native-modal';
import { tailwind } from 'tailwind';
import { createSocketAndListen, translate } from 'utils';
import ChatService from '../../../services/ChatService';

const ChatScreen = ({ route }) => {
    const { channel: channelProps } = route.params;
    const fleetbase = useFleetbase();
    const navigation = useNavigation();
    const [channel, setChannel] = useState(channelProps)
    const isMounted = useMountedState();
    const driver = useDriver();
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading] = useState(false);
    const [showUserList, setShowUserList] = useState(false);
    const [addedParticipants, setAddedParticipants] = useState([]);
    const driverUser = driver[0].attributes.user;

    const adapter = fleetbase.getAdapter();

    useEffect(() => {
        setChannel(channelProps)
    }, [route.params]);
    
    useEffect(()=>{

        if(!channel) return;
        console.log("Channel: ", channel)
        fetchUsers(channel?.id);

        const channelID = `chat.${channel.id}`;

        console.log('Socket: ', channelID);

        createSocketAndListen(channelID, socketEvent => {
            console.log('Socket event: ', socketEvent);
            const { event, data } = socketEvent;

            reloadChannel(channel?.id).then((res)=>{
                console.log("Channel :", channel)
            })
        });
        const messages = parseMessages(channel.feed);
        setMessages(messages);
    }, [channel])

    const parseMessages = messages => {
        return messages
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map((message, index) => {
                return parseMessage(message, index);
            });
    };

    const parseMessage = (message, index) => {
        const isSystem = message.type == 'log';
        const user = isSystem ? { _id: index, name: 'System' } : { _id: index, name: message.data.sender.name, avatar: message.data.sender.avatar };

        return {
            _id: message.data.id,
            text: isSystem ? message.data.resolved_content : message.data.content,
            createdAt: message.data.updated_at,
            system: isSystem,
            sent: true,
            user,
        };
    };

    const participantId = channel?.participants.find(chatParticipant => {
        return chatParticipant.user === driverUser;
    });

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchUsers(channel?.id);
        });

        return unsubscribe;
    }, [isMounted]);

    const uploadFile = async url => {
        // Extract filename from URL

        console.log('res>>>>>>>>', JSON.stringify(url));
        // const fileNameParts = url?.split('/')?.pop()?.split('?');

        const fileName = fileNameParts.length > 0 ? fileNameParts[0] : '';

        console.log('fileName::::', JSON.stringify(url));
        // Create local file path
        const localFile = `${RNFS.DocumentDirectoryPath}/${fileName}`;

        console.log('localFile::::', JSON.stringify(localFile));
        // Set up download options
        const options = {
            fromUrl: url,
            toFile: localFile,
        };

        RNFS.uploadFiles(options).promise.then(() => {
            RNFS.readDir(RNFS.DocumentDirectoryPath);
            FileViewer.open(localFile);
        });
    };

    const toggleUserList = () => {
        setShowUserList(!showUserList);
    };

    const fetchUsers = async id => {
        try {
            const response = await adapter.get(`chat-channels/${id}/available-participants`);
            setUsers(response);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const reloadChannel = async id => {
        try {
            const res = await adapter.get(`chat-channels/${id}`)
            setChannel(res)
        } catch (error) {
            console.error("Error: ", error)
        }
    }

    const addParticipant = async (channelId, participantId, participantName, avatar) => {
        const isParticipantAdded = channel.participants.some(participant => participant.id === participantId);

        if (isParticipantAdded) {
            Alert.alert('Alert', `${participantName} is already a part of this channel.`, [{ text: 'OK' }]);
            return;
        }

        try {
            await adapter.post(`chat-channels/${channelId}/add-participant`, { user: participantId });

            await reloadChannel(channel.id)
        
            const newMessage = {
                _id: new Date().getTime(),
                text: `Added ${participantName} to this channel`,
                createdAt: new Date(),
                system: true,
                sent: true,
                user: {
                    _id: 1,
                    name: 'System',
                },
            };
            setMessages(previousMessages => GiftedChat.append(previousMessages, [newMessage]));

            setShowUserList(false);
        } catch (error) {
            console.error('Add participant:', error);
        }
    };
    const renderPartificants = ({ participants, onDelete }) => {
        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tailwind('p-2')}>
                {participants.map(participant => (
                    <View key={participant.id} style={tailwind('flex flex-col items-center mr-2')}>
                        <View style={tailwind('relative')}>
                            <View style={tailwind('flex flex-row items-center')}>
                                <View
                                    style={[
                                        tailwind(participant.status === 'active' ? 'bg-green-500 w-4 h-4 rounded-full' : 'bg-yellow-500 w-3 h-3 rounded-full'),
                                        {
                                            position: 'absolute',
                                            left: 2,
                                            top: -2,
                                            zIndex: 1,
                                        },
                                    ]}
                                />
                                <FastImage
                                    source={participant.avatar_url ? { uri: participant.avatar_url } : require('../../../../assets/icon.png')}
                                    style={tailwind('w-10 h-10 rounded-full')}
                                />
                            </View>
                            <TouchableOpacity
                                style={[
                                    tailwind('absolute right-0'),
                                    {
                                        position: 'absolute',
                                        top: -4,
                                        right: -2,
                                        zIndex: 2,
                                    },
                                ]}
                                onPress={() => confirmRemove(participant.id)}>
                                <FontAwesomeIcon icon={faTrash} size={14} color="#FF0000" />
                            </TouchableOpacity>
                        </View>
                        <Text style={tailwind('text-sm text-gray-300')}>{participant.name}</Text>
                    </View>
                ))}
            </ScrollView>
        );
    };
    const confirmRemove = participantId => {
        Alert.alert(
            'Confirmation',
            'Are you sure you wish to remove this participant from the chat?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'OK',
                    onPress: () => removeParticipant(participantId),
                },
            ],
            { cancelable: false }
        );
    };

    const removeParticipant = async participantId => {
        try {
            await adapter.delete(`chat-channels/remove-participant/${participantId}`);

            setAddedParticipants(prevParticipants => prevParticipants.filter(participant => participant.id !== participantId));
            await reloadChannel(channel.id)
            const newMessage = {
                _id: new Date().getTime(),
                text: `Removed participant from this channel`,
                createdAt: new Date(),
                user: {
                    _id: 1,
                    name: 'System',
                },
            };
            setMessages(previousMessages => GiftedChat.append(previousMessages, [newMessage]));
        } catch (error) {
            console.error('Remove participant:', error);
        }
    };

    const onSend = async newMessage => {
        try {
            await adapter.post(`chat-channels/${channel?.id}/send-message`, { sender: participantId.id, content: newMessage[0].text });
            setShowUserList(false);
            setMessages(previousMessages => GiftedChat.append(previousMessages, newMessage));
        } catch (error) {
            console.error('Send error:', error);
        }
    };

    const renderSend = props => {
        return (
            <Send {...props}>
                <FontAwesomeIcon icon={faPaperPlane} size={20} color="#168AFF" style={tailwind('mr-2')} />
            </Send>
        );
    };

    const renderBubble = props => {
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    right: {
                        backgroundColor: '#919498',
                    },
                }}
                textStyle={{
                    right: {
                        color: '#fff',
                    },
                }}
            />
        );
    };

    const scrollToBottomComponent = () => {
        return <FontAwesomeIcon name="angle-double-down" size={22} color="#333" />;
    };

    const chooseFile = () => {
        const options = {
            title: 'Select File',
            storageOptions: {
                skipBackup: true,
                path: 'images',
            },
        };

        launchImageLibrary(options, response => {
            if (response.didCancel) {
                console.log('User cancelled image picker');
            } else if (response.error) {
                console.log('ImagePicker Error: ', response.error);
            } else {
                console.log('response::::', JSON.stringify(response.assets[0]));
                uploadFile(response.assets[0]);
            }
        });
    };

    const renderActions = () => (
        <Actions
            options={{
                'Choose From Library': () => {
                    chooseFile();
                },
                Cancel: () => {
                    console.log('Cancel');
                },
            }}
            optionTintColor="#222B45"
        />
    );

    return (
        <View style={tailwind('w-full h-full bg-gray-800')}>
            <View style={tailwind('flex flex-row')}>
                <View style={tailwind('flex flex-row items-center top-2')}>
                    <TouchableOpacity style={tailwind('p-2')} onPress={() => navigation.pop(2)}>
                        <FontAwesomeIcon size={25} icon={faAngleLeft} style={tailwind('text-gray-300')} />
                    </TouchableOpacity>
                    <View style={tailwind('flex flex-row items-center')}>
                        <Text style={tailwind('text-sm text-gray-300 w-72 text-center')}>
                            {channel?.name}{' '}
                            <TouchableOpacity style={tailwind('rounded-full')} onPress={() => navigation.navigate('ChannelScreen', { data: channel })}>
                                <FontAwesomeIcon size={18} icon={faEdit} style={tailwind('text-gray-300 mt-1')} />
                            </TouchableOpacity>
                        </Text>
                    </View>

                    <View style={tailwind('flex flex-col items-center left-6')}>
                        <TouchableOpacity style={tailwind('rounded-full')} onPress={toggleUserList}>
                            <FontAwesomeIcon size={15} icon={faUser} style={tailwind('text-gray-300')} />
                        </TouchableOpacity>
                    </View>
                </View>
                <Modal
                    isVisible={showUserList}
                    onBackdropPress={toggleUserList}
                    style={tailwind('justify-end m-0')}
                    backdropOpacity={0.5}
                    useNativeDriver
                    animationIn="slideInUp"
                    animationOut="slideOutDown">
                    <View style={tailwind('bg-gray-800 w-full h-72 rounded-lg p-4')}>
                        <Text style={tailwind('text-lg mb-2 text-gray-300')}>{translate('Core.ChatScreen.title')}:</Text>

                        {isLoading ? (
                            <View style={tailwind('flex items-center justify-center h-full')}>
                                <ActivityIndicator size="large" color="#FFFFFF" />
                            </View>
                        ) : (
                            <FlatList
                                data={users}
                                keyExtractor={item => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => addParticipant(channel.id, item.id, item.name, item.avatar_url)}
                                        style={tailwind('flex flex-row items-center py-2  bg-gray-900 rounded-lg mb-2')}>
                                        <View style={tailwind('flex flex-row items-center ml-2')}>
                                            <View
                                                style={[
                                                    tailwind(item.status === 'active' ? 'bg-green-500 w-4 h-4 rounded-full' : 'bg-yellow-500 w-3 h-3 rounded-full'),
                                                    {
                                                        position: 'absolute',
                                                        left: 2,
                                                        top: -2,
                                                        zIndex: 1,
                                                    },
                                                ]}
                                            />
                                            <FastImage
                                                source={item.avatar_url ? { uri: item.avatar_url } : require('../../../../assets/icon.png')}
                                                style={tailwind('w-10 h-10 rounded-full')}
                                            />
                                        </View>
                                        <Text style={tailwind('text-sm text-white ml-2')}>{item.name}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </Modal>
            </View>
            <View style={tailwind('p-4')}>
                {renderPartificants({
                    participants: channel?.participants || [], onDelete: removeParticipant})}
            </View>
            <View style={tailwind('flex-1 p-4')}>
                <GiftedChat
                    messages={messages}
                    onSend={onSend}
                    user={{
                        _id: 1,
                    }}
                    renderBubble={renderBubble}
                    alwaysShowSend
                    scrollToBottom
                    renderInputToolbar={props => <InputToolbar {...props} containerStyle={tailwind('bg-white items-center justify-center mx-2 rounded-lg mb-0')} />}
                    renderActions={renderActions}
                    scrollToBottomComponent={scrollToBottomComponent}
                    renderSend={renderSend}
                />
            </View>
        </View>
    );
};

export default ChatScreen;
