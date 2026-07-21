import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import galleryCastle from '../../assets/images/home/gallery-castle.png';
import galleryJungle from '../../assets/images/home/gallery-jungle.png';
import galleryPenguin from '../../assets/images/home/gallery-penguin.png';

import { ChildPageHeader } from '@/components/child-page-header';
import { useAppState } from '@/state/app-provider';

const galleryIdeas = [
  { image: galleryCastle, title: 'Sky Castle Quest', prompt: 'What could live on a floating island?', color: '#8A58E8' },
  { image: galleryJungle, title: 'Jungle Surprise', prompt: 'Invent a treasure that can move.', color: '#35B88A' },
  { image: galleryPenguin, title: 'Penguin Explorer', prompt: 'How would your hero cross the ice?', color: '#3E8EE8' },
];

export default function GalleryTabScreen() {
  const { child } = useAppState();

  if (!child) return <Redirect href="/" />;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <LinearGradient colors={['#12102F', '#090923']} style={StyleSheet.absoluteFill} />
      <ChildPageHeader childId={child.childId} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.eyebrow}>IDEAS TO PLAY WITH</Text>
          <Text style={styles.pageTitle}>Project gallery</Text>
          <View style={styles.underline} />
        </View>
        <Text style={styles.subtitle}>Look around for a spark, then change it into something that feels like yours.</Text>

        <View style={styles.featuredCard}>
          <Image source={galleryCastle} style={styles.featuredImage} />
          <LinearGradient colors={['transparent', '#161033E8']} style={styles.featuredShade} />
          <View style={styles.featuredCopy}>
            <Text style={styles.featuredKicker}>TODAY&apos;S IDEA SPARK</Text>
            <Text style={styles.featuredTitle}>Build a world in an impossible place.</Text>
          </View>
        </View>

        <View style={styles.ideaGrid}>
          {galleryIdeas.map((idea) => (
            <View key={idea.title} style={styles.ideaCard}>
              <Image source={idea.image} style={styles.ideaImage} />
              <View style={styles.ideaCopy}>
                <View style={[styles.sparkDot, { backgroundColor: idea.color }]}><Text style={styles.spark}>★</Text></View>
                <View style={styles.ideaText}>
                  <Text style={styles.ideaTitle}>{idea.title}</Text>
                  <Text style={styles.ideaPrompt}>{idea.prompt}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <LinearGradient colors={['#39216D', '#262052']} style={styles.noteCard}>
          <Text style={styles.noteSpark}>✦</Text>
          <View style={styles.noteCopy}>
            <Text style={styles.noteTitle}>There is no one right idea.</Text>
            <Text style={styles.noteBody}>Mix two sparks together, make one silly, or ask Milo to help you invent a totally different world.</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D0C26' },
  scrollContent: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 15, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 125 },
  eyebrow: { color: '#F3C958', fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  pageTitle: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', letterSpacing: -1.5, lineHeight: 42 },
  underline: { width: 56, height: 5, borderRadius: 4, backgroundColor: '#FFE36C', transform: [{ rotate: '-4deg' }] },
  subtitle: { color: '#B8B2C8', fontSize: 14, lineHeight: 20 },
  featuredCard: { position: 'relative', height: 225, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF36', borderRadius: 25 },
  featuredImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  featuredShade: { ...StyleSheet.absoluteFillObject, top: '35%' },
  featuredCopy: { position: 'absolute', right: 18, bottom: 16, left: 18, gap: 3 },
  featuredKicker: { color: '#FFE36C', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  featuredTitle: { maxWidth: 320, color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 24 },
  ideaGrid: { gap: 12 },
  ideaCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF27', borderRadius: 22, backgroundColor: '#201A43' },
  ideaImage: { width: '100%', height: 190, resizeMode: 'cover' },
  ideaCopy: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  sparkDot: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  spark: { color: '#FFF8DA', fontSize: 20 },
  ideaText: { flex: 1, gap: 2 },
  ideaTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  ideaPrompt: { color: '#BDB7CD', fontSize: 12, lineHeight: 17 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: '#8D6BE25C', borderRadius: 22, padding: 17 },
  noteSpark: { color: '#7AE0C5', fontSize: 28, fontWeight: '900' },
  noteCopy: { flex: 1, gap: 4 },
  noteTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  noteBody: { color: '#C5BFDA', fontSize: 12, lineHeight: 18 },
});
