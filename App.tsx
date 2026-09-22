import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons'; //npx expo install @expo/vector-icons
import { useRouter } from 'expo-router';


export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <View style={{ alignItems: 'center', backgroundColor: '#7371f1',width:"20%", borderRadius: 35, height: "80%", justifyContent: 'center'  }}>
          <Feather name="home" size={20} color="black" />
          <Text style={{ fontSize: 12 }}>Home</Text>
        </View>
        <View style={styles.box_icon}>
          <Feather name="search" size={20} color="black" />
          <Text style={{ fontSize: 12 }}>Search</Text>
        </View>
        <View style={styles.box_icon}>
          <Feather name="heart" size={20} color="black" />
          <Text style={{ fontSize: 12 }}>Heart</Text>
        </View>
        <View style={styles.box_icon}>
          <Feather name="user" size={20} color="black" />
          <Text style={{ fontSize: 12 }}>User</Text>
        </View>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#658cc0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    position: 'absolute',
    width: '80%',
    height: 64,
    backgroundColor: '#fff',
    borderRadius: 35,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  box_icon: {
    alignItems: 'center',
    width: "20%",
    height: "80%",
    justifyContent: 'center',
  },
});
