import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';

function TempSermonScreen(): React.JSX.Element {
  const [sermons, setSermons] = useState<{ id: string; title: string; content: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await firestore().collection('sermons').get();
        const sermonsData = snapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,     // 설교 제목
          content: doc.data().content, // 설교 본문
        }));
        setSermons(sermonsData);
      } catch (error) {
        console.error('Error fetching sermons:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    console.log('Sermons:', sermons);
  }, [sermons])

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Sermons</Text>
      {loading ? (
        <Text>Loading...</Text>
      ) : (
        sermons.map(sermon => (
          <View key={sermon.id} style={styles.sermonItem}>
            <Text style={styles.sermonTitle}>{sermon.title}</Text>
            <Text style={styles.sermonContent}>{sermon.content}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sermonItem: {
    marginBottom: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  sermonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sermonContent: {
    fontSize: 16,
    color: '#333',
  },
});

export default TempSermonScreen;
