import { faWindowClose } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import tailwind from 'tailwind';
import { getColorCode, logError } from 'utils';
import { useDriver } from 'utils/Auth';

const Organization = ({ navigation }) => {
    const [driver] = useDriver();
    const [organizations, setOrganizations] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = () => {
        setIsLoading(true);
        setIsRefreshing(true);
        driver
            .listOrganizations()
            .then(setOrganizations)
            .catch(logError)
            .finally(() => {
                setIsLoading(false);
                setIsRefreshing(false);
            });
    };

    useEffect(() => {
        setIsLoading(true);
        fetchData();
    }, []);

    const switchOrganization = organizationId => {
        return driver.switchOrganization(organizationId);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={() => switchOrganization(item.id)}>
            <View style={[tailwind('p-1')]}>
                <View style={[tailwind('px-4 py-2 flex flex-row items-center rounded-r-md')]}>
                    <Text style={tailwind('text-gray-50 text-base')} numberOfLines={1}>
                        <Text>{item?.getAttribute('name')}</Text>
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={tailwind('w-full h-full bg-gray-800 flex-grow')}>
            {isLoading ? (
                <ActivityIndicator size="small" color={getColorCode('white')} style={tailwind('mr-2')} />
            ) : (
                <View style={tailwind('flex flex-row items-center justify-between p-4 ')}>
                    <View>
                        <Text style={tailwind('font-bold text-white text-base')}>Organizations</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={tailwind('rounded-full ')}>
                        <FontAwesomeIcon size={20} icon={faWindowClose} style={tailwind('text-red-400 ')} />
                    </TouchableOpacity>
                </View>
            )}
            <FlatList
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={fetchData} tintColor={getColorCode('text-blue-200')} />}
                data={organizations}
                keyExtractor={item => item.id}
                renderItem={renderItem}
            />
        </View>
    );
};

export default Organization;
