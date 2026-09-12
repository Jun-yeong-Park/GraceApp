import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { MoreStackParamList, Announcement } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Icon from '../components/Icon';

type HomeNavigationProp = NativeStackNavigationProp<MoreStackParamList, 'HomeMain'>;

const ANNOUNCEMENT_DATES = ['2026-04-08', '2026-04-05', '2026-04-03'];

interface Verse { ko: string; en: string; es: string; ref: { ko: string; en: string; es: string } }

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location?: string;
  description?: string;
}

const CURATED_VERSES: Verse[] = [
  {
    ko: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라.',
    en: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    es: 'Porque tanto amó Dios al mundo que dio a su Hijo unigénito, para que todo el que cree en él no se pierda, sino que tenga vida eterna.',
    ref: { ko: '요한복음 3:16', en: 'John 3:16', es: 'Juan 3:16' },
  },
  {
    ko: '내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라.',
    en: 'I can do all this through him who gives me strength.',
    es: 'Todo lo puedo en Cristo que me fortalece.',
    ref: { ko: '빌립보서 4:13', en: 'Philippians 4:13', es: 'Filipenses 4:13' },
  },
  {
    ko: '우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라.',
    en: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
    es: 'Ahora bien, sabemos que Dios dispone todas las cosas para el bien de quienes lo aman.',
    ref: { ko: '로마서 8:28', en: 'Romans 8:28', es: 'Romanos 8:28' },
  },
  {
    ko: '너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라. 너는 범사에 그를 인정하라 그리하면 네 길을 지도하시리라.',
    en: 'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.',
    es: 'Confía en el Señor de todo corazón, y no en tu propia inteligencia. Reconócelo en todos tus caminos, y él allanará tus sendas.',
    ref: { ko: '잠언 3:5-6', en: 'Proverbs 3:5-6', es: 'Proverbios 3:5-6' },
  },
  {
    ko: '내가 네게 명령한 것이 아니냐 강하고 담대하라 두려워하지 말며 놀라지 말라 네 하나님 여호와가 네가 어디로 가든지 너와 함께 하느니라.',
    en: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',
    es: '¿Acaso no te he mandado que seas fuerte y valiente? No tengas miedo ni te desanimes, porque el Señor tu Dios estará contigo dondequiera que vayas.',
    ref: { ko: '여호수아 1:9', en: 'Joshua 1:9', es: 'Josué 1:9' },
  },
  {
    ko: '여호와는 나의 목자시니 내게 부족함이 없으리로다.',
    en: 'The Lord is my shepherd, I lack nothing.',
    es: 'El Señor es mi pastor; nada me falta.',
    ref: { ko: '시편 23:1', en: 'Psalm 23:1', es: 'Salmo 23:1' },
  },
  {
    ko: '그런즉 너희는 먼저 그의 나라와 그의 의를 구하라 그리하면 이 모든 것을 너희에게 더하시리라.',
    en: 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.',
    es: 'Más bien, busquen primeramente el reino de Dios y su justicia, y todas estas cosas les serán añadidas.',
    ref: { ko: '마태복음 6:33', en: 'Matthew 6:33', es: 'Mateo 6:33' },
  },
  {
    ko: '오직 여호와를 앙망하는 자는 새 힘을 얻으리니 독수리가 날개 치며 올라감 같을 것이요 달음박질하여도 곤비하지 아니하겠고 걸어가도 피곤하지 아니하리로다.',
    en: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.',
    es: 'Pero los que confían en el Señor renovarán sus fuerzas; volarán como las águilas, correrán y no se fatigarán, caminarán y no se cansarán.',
    ref: { ko: '이사야 40:31', en: 'Isaiah 40:31', es: 'Isaías 40:31' },
  },
  {
    ko: '수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라.',
    en: 'Come to me, all you who are weary and burdened, and I will give you rest.',
    es: 'Vengan a mí todos ustedes que están cansados y agobiados, y yo les daré descanso.',
    ref: { ko: '마태복음 11:28', en: 'Matthew 11:28', es: 'Mateo 11:28' },
  },
  {
    ko: '여호와의 말씀이니라 너희를 향한 나의 생각을 내가 아나니 평안이요 재앙이 아니니라 너희에게 미래와 희망을 주는 것이니라.',
    en: '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future."',
    es: '"Porque yo sé muy bien los planes que tengo para ustedes —afirma el Señor—, planes de bienestar y no de calamidad, a fin de darles un futuro y una esperanza."',
    ref: { ko: '예레미야 29:11', en: 'Jeremiah 29:11', es: 'Jeremías 29:11' },
  },
  {
    ko: '하나님은 우리의 피난처시요 힘이시니 환난 중에 만날 큰 도움이시라.',
    en: 'God is our refuge and strength, an ever-present help in trouble.',
    es: 'Dios es nuestro amparo y nuestra fortaleza, nuestra ayuda segura en momentos de angustia.',
    ref: { ko: '시편 46:1', en: 'Psalm 46:1', es: 'Salmo 46:1' },
  },
  {
    ko: '예수께서 이르시되 내가 곧 길이요 진리요 생명이니 나로 말미암지 않고는 아버지께로 올 자가 없느니라.',
    en: 'Jesus answered, "I am the way and the truth and the life. No one comes to the Father except through me."',
    es: 'Yo soy el camino, la verdad y la vida —le contestó Jesús—. Nadie llega al Padre sino por mí.',
    ref: { ko: '요한복음 14:6', en: 'John 14:6', es: 'Juan 14:6' },
  },
  {
    ko: '하나님이 우리에게 주신 것은 두려워하는 마음이 아니요 오직 능력과 사랑과 절제하는 마음이니.',
    en: 'For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.',
    es: 'Pues Dios no nos ha dado un espíritu de timidez, sino de poder, de amor y de dominio propio.',
    ref: { ko: '디모데후서 1:7', en: '2 Timothy 1:7', es: '2 Timoteo 1:7' },
  },
  {
    ko: '주의 말씀은 내 발에 등이요 내 길에 빛이니이다.',
    en: 'Your word is a lamp for my feet, a light on my path.',
    es: 'Tu palabra es una lámpara a mis pies; es una luz en mi sendero.',
    ref: { ko: '시편 119:105', en: 'Psalm 119:105', es: 'Salmo 119:105' },
  },
  {
    ko: '내가 그리스도와 함께 십자가에 못 박혔나니 그런즉 이제는 내가 사는 것이 아니요 오직 내 안에 그리스도께서 사시는 것이라.',
    en: 'I have been crucified with Christ and I no longer live, but Christ lives in me.',
    es: 'He sido crucificado con Cristo, y ya no vivo yo sino que Cristo vive en mí.',
    ref: { ko: '갈라디아서 2:20', en: 'Galatians 2:20', es: 'Gálatas 2:20' },
  },
  {
    ko: '볼지어다 내가 문 밖에 서서 두드리노니 누구든지 내 음성을 듣고 문을 열면 내가 그에게로 들어가 그와 더불어 먹고 그는 나와 더불어 먹으리라.',
    en: 'Here I am! I stand at the door and knock. If anyone hears my voice and opens the door, I will come in and eat with that person, and they with me.',
    es: 'Mira que estoy a la puerta y llamo. Si alguno oye mi voz y abre la puerta, entraré, y cenaré con él, y él conmigo.',
    ref: { ko: '요한계시록 3:20', en: 'Revelation 3:20', es: 'Apocalipsis 3:20' },
  },
  {
    ko: '사랑은 오래 참고 사랑은 온유하며 시기하지 아니하며 사랑은 자랑하지 아니하며 교만하지 아니하며.',
    en: 'Love is patient, love is kind. It does not envy, it does not boast, it is not proud.',
    es: 'El amor es paciente, es bondadoso. El amor no es envidioso ni jactancioso ni orgulloso.',
    ref: { ko: '고린도전서 13:4', en: '1 Corinthians 13:4', es: '1 Corintios 13:4' },
  },
  {
    ko: '아무것도 염려하지 말고 다만 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라.',
    en: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.',
    es: 'No se inquieten por nada; más bien, en toda ocasión, con oración y ruego, presenten sus peticiones a Dios y denle gracias.',
    ref: { ko: '빌립보서 4:6', en: 'Philippians 4:6', es: 'Filipenses 4:6' },
  },
  {
    ko: '여호와는 네 오른쪽에서 너를 지키는 네 그늘이시라. 낮의 해가 너를 상하게 하지 아니하며 밤의 달도 너를 해치지 아니하리로다.',
    en: 'The Lord watches over you — the Lord is your shade at your right hand; the sun will not harm you by day, nor the moon by night.',
    es: 'El Señor es quien te cuida, el Señor es tu sombra protectora. De día el sol no te hará daño, ni la luna de noche.',
    ref: { ko: '시편 121:5-6', en: 'Psalm 121:5-6', es: 'Salmo 121:5-6' },
  },
  {
    ko: '이는 내 생각이 너희의 생각과 다르며 내 길은 너희의 길과 다름이니라 여호와의 말씀이니라 이는 하늘이 땅보다 높음 같이 내 길은 너희의 길보다 높으며 내 생각은 너희의 생각보다 높음이니라.',
    en: '"For my thoughts are not your thoughts, neither are your ways my ways," declares the Lord. "As the heavens are higher than the earth, so are my ways higher than your ways and my thoughts than your thoughts."',
    es: '"Mis pensamientos no son los de ustedes, ni sus caminos son los míos —afirma el Señor—. Mis caminos y mis pensamientos son más altos que los de ustedes; ¡más altos que los cielos sobre la tierra!"',
    ref: { ko: '이사야 55:8-9', en: 'Isaiah 55:8-9', es: 'Isaías 55:8-9' },
  },
  // 21
  {
    ko: '모든 사람이 죄를 범하였으매 하나님의 영광에 이르지 못하더니 그리스도 예수 안에 있는 속량으로 말미암아 하나님의 은혜로 값 없이 의롭다 하심을 얻은 자 되었느니라.',
    en: 'For all have sinned and fall short of the glory of God, and all are justified freely by his grace through the redemption that came by Christ Jesus.',
    es: 'Pues todos han pecado y están privados de la gloria de Dios, pero por su gracia son justificados gratuitamente mediante la redención que Cristo Jesús efectuó.',
    ref: { ko: '로마서 3:23-24', en: 'Romans 3:23-24', es: 'Romanos 3:23-24' },
  },
  // 22
  {
    ko: '죄의 삯은 사망이요 하나님의 은사는 그리스도 예수 우리 주 안에 있는 영생이니라.',
    en: 'For the wages of sin is death, but the gift of God is eternal life in Christ Jesus our Lord.',
    es: 'Porque la paga del pecado es muerte, mientras que la dádiva de Dios es vida eterna en Cristo Jesús, nuestro Señor.',
    ref: { ko: '로마서 6:23', en: 'Romans 6:23', es: 'Romanos 6:23' },
  },
  // 23
  {
    ko: '너희는 그 은혜에 의하여 믿음으로 말미암아 구원을 받았으니 이것은 너희에게서 난 것이 아니요 하나님의 선물이라. 행위에서 난 것이 아니니 이는 누구든지 자랑하지 못하게 함이라.',
    en: 'For it is by grace you have been saved, through faith — and this is not from yourselves, it is the gift of God — not by works, so that no one can boast.',
    es: 'Porque ustedes son salvos por la gracia mediante la fe; esto no procede de ustedes, sino que es el regalo de Dios, no por obras, para que nadie se jacte.',
    ref: { ko: '에베소서 2:8-9', en: 'Ephesians 2:8-9', es: 'Efesios 2:8-9' },
  },
  // 24
  {
    ko: '네가 만일 네 입으로 예수를 주로 시인하며 또 하나님께서 그를 죽은 자 가운데서 살리신 것을 네 마음에 믿으면 구원을 받으리라.',
    en: 'If you declare with your mouth, "Jesus is Lord," and believe in your heart that God raised him from the dead, you will be saved.',
    es: 'Si confiesas con tu boca que Jesús es el Señor y crees en tu corazón que Dios lo levantó de entre los muertos, serás salvo.',
    ref: { ko: '로마서 10:9', en: 'Romans 10:9', es: 'Romanos 10:9' },
  },
  // 25
  {
    ko: '내가 확신하노니 사망이나 생명이나 천사들이나 권세자들이나 현재 일이나 장래 일이나 능력이나 높음이나 깊음이나 다른 어떤 피조물이라도 우리를 그리스도 예수 안에 있는 하나님의 사랑에서 끊을 수 없으리라.',
    en: 'For I am convinced that neither death nor life, neither angels nor demons, neither the present nor the future, nor any powers, neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.',
    es: 'Pues estoy convencido de que ni la muerte ni la vida, ni los ángeles ni los demonios, ni lo presente ni lo por venir, ni los poderes, ni lo alto ni lo profundo, ni cosa alguna en toda la creación, podrá apartarnos del amor que Dios nos ha manifestado en Cristo Jesús nuestro Señor.',
    ref: { ko: '로마서 8:38-39', en: 'Romans 8:38-39', es: 'Romanos 8:38-39' },
  },
  // 26
  {
    ko: '하나님은 사랑이심이라 사랑 안에 거하는 자는 하나님 안에 거하고 하나님도 그의 안에 거하시느니라.',
    en: 'God is love. Whoever lives in love lives in God, and God in them.',
    es: 'Dios es amor. El que permanece en amor, permanece en Dios, y Dios en él.',
    ref: { ko: '요한일서 4:16', en: '1 John 4:16', es: '1 Juan 4:16' },
  },
  // 27
  {
    ko: '또 여호와를 기뻐하라 그가 네 마음의 소원을 네게 이루어 주시리로다.',
    en: 'Take delight in the Lord, and he will give you the desires of your heart.',
    es: 'Deléitate en el Señor, y él te concederá los deseos de tu corazón.',
    ref: { ko: '시편 37:4', en: 'Psalm 37:4', es: 'Salmo 37:4' },
  },
  // 28
  {
    ko: '여호와의 인자와 긍휼이 무궁하시므로 우리가 진멸되지 아니함이니이다 이것들이 아침마다 새로우니 주의 성실하심이 크시도소이다.',
    en: 'Because of the Lord\'s great love we are not consumed, for his compassions never fail. They are new every morning; great is your faithfulness.',
    es: 'El gran amor del Señor nunca se acaba, y su compasión jamás se agota. Cada mañana se renuevan sus bondades; ¡muy grande es su fidelidad!',
    ref: { ko: '예레미야애가 3:22-23', en: 'Lamentations 3:22-23', es: 'Lamentaciones 3:22-23' },
  },
  // 29
  {
    ko: '너희 염려를 다 주께 맡기라 이는 그가 너희를 돌보심이라.',
    en: 'Cast all your anxiety on him because he cares for you.',
    es: 'Depositen en él toda ansiedad, porque él cuida de ustedes.',
    ref: { ko: '베드로전서 5:7', en: '1 Peter 5:7', es: '1 Pedro 5:7' },
  },
  // 30
  {
    ko: '여호와는 나의 빛이요 나의 구원이시니 내가 누구를 두려워하리요 여호와는 내 생명의 능력이시니 내가 누구를 무서워하리요.',
    en: 'The Lord is my light and my salvation — whom shall I fear? The Lord is the stronghold of my life — of whom shall I be afraid?',
    es: 'El Señor es mi luz y mi salvación; ¿a quién temeré? El Señor es el baluarte de mi vida; ¿quién podrá amedrentarme?',
    ref: { ko: '시편 27:1', en: 'Psalm 27:1', es: 'Salmo 27:1' },
  },
  // 31
  {
    ko: '나는 포도나무요 너희는 가지라 그가 내 안에, 내가 그 안에 거하면 사람이 열매를 많이 맺나니 나를 떠나서는 너희가 아무것도 할 수 없음이라.',
    en: 'I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing.',
    es: 'Yo soy la vid y ustedes son las ramas. El que permanece en mí, como yo en él, dará mucho fruto; separados de mí no pueden ustedes hacer nada.',
    ref: { ko: '요한복음 15:5', en: 'John 15:5', es: 'Juan 15:5' },
  },
  // 32
  {
    ko: '믿음은 바라는 것들의 실상이요 보이지 않는 것들의 증거니.',
    en: 'Now faith is confidence in what we hope for and assurance about what we do not see.',
    es: 'Ahora bien, la fe es la garantía de lo que se espera, la certeza de lo que no se ve.',
    ref: { ko: '히브리서 11:1', en: 'Hebrews 11:1', es: 'Hebreos 11:1' },
  },
  // 33
  {
    ko: '그런즉 누구든지 그리스도 안에 있으면 새로운 피조물이라 이전 것은 지나갔으니 보라 새 것이 되었도다.',
    en: 'Therefore, if anyone is in Christ, the new creation has come: The old has gone, the new is here!',
    es: 'Por lo tanto, si alguno está en Cristo, es una nueva creación. ¡Lo viejo ha pasado, ha llegado ya lo nuevo!',
    ref: { ko: '고린도후서 5:17', en: '2 Corinthians 5:17', es: '2 Corintios 5:17' },
  },
  // 34
  {
    ko: '내가 주께 감사하옴은 나를 지으심이 심히 기묘하심이라 주께서 하시는 일이 기이함을 내 영혼이 잘 아나이다.',
    en: 'I praise you because I am fearfully and wonderfully made; your works are wonderful, I know that full well.',
    es: 'Te alabo porque soy una creación admirable. ¡Tus obras son maravillosas, y esto lo sé muy bien!',
    ref: { ko: '시편 139:14', en: 'Psalm 139:14', es: 'Salmo 139:14' },
  },
  // 35
  {
    ko: '두려워하지 말라 내가 너와 함께함이라 놀라지 말라 나는 네 하나님이 됨이라 내가 너를 굳세게 하리라 참으로 너를 도와주리라 참으로 나의 의로운 오른손으로 너를 붙들리라.',
    en: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.',
    es: 'Así que no temas, porque yo estoy contigo; no te angusties, porque yo soy tu Dios. Te fortaleceré y te ayudaré; te sostendré con mi diestra victoriosa.',
    ref: { ko: '이사야 41:10', en: 'Isaiah 41:10', es: 'Isaías 41:10' },
  },
  // 36
  {
    ko: '내가 온 것은 양으로 생명을 얻게 하고 더 풍성히 얻게 하려는 것이라.',
    en: 'I have come that they may have life, and have it to the full.',
    es: 'Yo he venido para que tengan vida, y la tengan en abundancia.',
    ref: { ko: '요한복음 10:10', en: 'John 10:10', es: 'Juan 10:10' },
  },
  // 37
  {
    ko: '항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라.',
    en: 'Rejoice always, pray continually, give thanks in all circumstances; for this is God\'s will for you in Christ Jesus.',
    es: 'Estén siempre alegres, oren sin cesar, den gracias a Dios en toda situación, porque esta es su voluntad para ustedes en Cristo Jesús.',
    ref: { ko: '데살로니가전서 5:16-18', en: '1 Thessalonians 5:16-18', es: '1 Tesalonicenses 5:16-18' },
  },
  // 38
  {
    ko: '사람이 감당할 시험밖에는 너희가 당한 것이 없나니 오직 하나님은 미쁘사 너희가 감당하지 못할 시험 당함을 허락하지 아니하시고 시험 당할 즈음에 또한 피할 길을 내사 너희로 능히 감당하게 하시느니라.',
    en: 'No temptation has overtaken you except what is common to mankind. And God is faithful; he will not let you be tempted beyond what you can bear. But when you are tempted, he will also provide a way out so that you can endure it.',
    es: 'Ustedes no han sufrido ninguna tentación que no sea común al género humano. Pero Dios es fiel, y no permitirá que ustedes sean tentados más allá de lo que puedan aguantar. Más bien, cuando llegue la tentación, él les dará también una salida a fin de que puedan resistir.',
    ref: { ko: '고린도전서 10:13', en: '1 Corinthians 10:13', es: '1 Corintios 10:13' },
  },
  // 39
  {
    ko: '무슨 일을 하든지 마음을 다하여 주께 하듯 하고 사람에게 하듯 하지 말라.',
    en: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.',
    es: 'Hagan lo que hagan, trabajen de buena gana, como para el Señor y no como para nadie en este mundo.',
    ref: { ko: '골로새서 3:23', en: 'Colossians 3:23', es: 'Colosenses 3:23' },
  },
  // 40
  {
    ko: '주께서 심지가 견고한 자를 평강하고 평강하도록 지키시리니 이는 그가 주를 신뢰함이니이다.',
    en: 'You will keep in perfect peace those whose minds are steadfast, because they trust in you.',
    es: 'Al de carácter firme lo guardarás en perfecta paz, porque en ti confía.',
    ref: { ko: '이사야 26:3', en: 'Isaiah 26:3', es: 'Isaías 26:3' },
  },
  // 41
  {
    ko: '내 이름으로 일컫는 내 백성이 그들의 악한 길에서 떠나 스스로 낮추고 기도하여 내 얼굴을 찾으면 내가 하늘에서 듣고 그들의 죄를 사하고 그들의 땅을 고칠지라.',
    en: 'If my people, who are called by my name, will humble themselves and pray and seek my face and turn from their wicked ways, then I will hear from heaven, and I will forgive their sin and will heal their land.',
    es: 'Si mi pueblo, que lleva mi nombre, se humilla y ora, y me busca y abandona su mala conducta, yo lo escucharé desde el cielo, perdonaré su pecado y restauraré su tierra.',
    ref: { ko: '역대하 7:14', en: '2 Chronicles 7:14', es: '2 Crónicas 7:14' },
  },
  // 42
  {
    ko: '사람아 주께서 선한 것이 무엇임을 네게 보이셨나니 여호와께서 네게 구하시는 것은 오직 정의를 행하며 인자를 사랑하며 겸손하게 네 하나님과 함께 행하는 것이 아니냐.',
    en: 'He has shown you, O mortal, what is good. And what does the Lord require of you? To act justly and to love mercy and to walk humbly with your God.',
    es: 'Ya se te ha declarado lo que es bueno, ya se te ha dicho lo que de ti espera el Señor: Practicar la justicia, amar la misericordia, y humillarte ante tu Dios.',
    ref: { ko: '미가 6:8', en: 'Micah 6:8', es: 'Miqueas 6:8' },
  },
  // 43
  {
    ko: '강하고 담대하라 두려워하지 말라 그들 앞에서 떨지 말라 이는 네 하나님 여호와 그가 너와 함께 가시며 결코 너를 떠나지 아니하시며 버리지 아니하실 것임이라.',
    en: 'Be strong and courageous. Do not be afraid or terrified because of them, for the Lord your God goes with you; he will never leave you nor forsake you.',
    es: 'Sean fuertes y valientes. No teman ni se asusten ante esas naciones, pues el Señor su Dios siempre los acompañará; nunca los dejará ni los abandonará.',
    ref: { ko: '신명기 31:6', en: 'Deuteronomy 31:6', es: 'Deuteronomio 31:6' },
  },
  // 44
  {
    ko: '이러므로 우리에게 구름같이 둘러싼 허다한 증인들이 있으니 모든 무거운 것과 얽매이기 쉬운 죄를 벗어 버리고 인내로써 우리 앞에 당한 경주를 하며 믿음의 주요 또 온전하게 하시는 이인 예수를 바라보자.',
    en: 'Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off everything that hinders and the sin that so easily entangles. And let us run with perseverance the race marked out for us, fixing our eyes on Jesus, the pioneer and perfecter of faith.',
    es: 'Por tanto, también nosotros, que estamos rodeados de una multitud tan grande de testigos, despojémonos del lastre que nos estorba, en especial del pecado que nos asedia, y corramos con perseverancia la carrera que tenemos por delante. Fijemos la mirada en Jesús, el iniciador y perfeccionador de nuestra fe.',
    ref: { ko: '히브리서 12:1-2', en: 'Hebrews 12:1-2', es: 'Hebreos 12:1-2' },
  },
  // 45
  {
    ko: '그러므로 형제들아 내가 하나님의 모든 자비하심으로 너희를 권하노니 너희 몸을 하나님이 기뻐하시는 거룩한 산 제물로 드리라 이는 너희가 드릴 영적 예배니라.',
    en: 'Therefore, I urge you, brothers and sisters, in view of God\'s mercy, to offer your bodies as a living sacrifice, holy and pleasing to God — this is your true and proper worship.',
    es: 'Por lo tanto, hermanos, tomando en cuenta la misericordia de Dios, les ruego que cada uno de ustedes, en adoración espiritual, ofrezca su cuerpo como sacrificio vivo, santo y agradable a Dios.',
    ref: { ko: '로마서 12:1', en: 'Romans 12:1', es: 'Romanos 12:1' },
  },
  // 46
  {
    ko: '너희는 이 세대를 본받지 말고 오직 마음을 새롭게 함으로 변화를 받아 하나님의 선하시고 기뻐하시고 온전하신 뜻이 무엇인지 분별하도록 하라.',
    en: 'Do not conform to the pattern of this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what God\'s will is — his good, pleasing and perfect will.',
    es: 'No se amolden al mundo actual, sino sean transformados mediante la renovación de su mente. Así podrán comprobar cuál es la voluntad de Dios, buena, agradable y perfecta.',
    ref: { ko: '로마서 12:2', en: 'Romans 12:2', es: 'Romanos 12:2' },
  },
  // 47
  {
    ko: '너희는 세상의 빛이라 산 위에 있는 동네가 숨겨지지 못할 것이요.',
    en: 'You are the light of the world. A town built on a hill cannot be hidden.',
    es: 'Ustedes son la luz del mundo. Una ciudad en lo alto de una colina no puede esconderse.',
    ref: { ko: '마태복음 5:14', en: 'Matthew 5:14', es: 'Mateo 5:14' },
  },
  // 48
  {
    ko: '내 형제들아 너희가 여러 가지 시험을 당하거든 온전히 기쁘게 여기라 이는 너희 믿음의 시련이 인내를 만들어 내는 줄 너희가 앎이라.',
    en: 'Consider it pure joy, my brothers and sisters, whenever you face trials of many kinds, because you know that the testing of your faith produces perseverance.',
    es: 'Hermanos míos, considérense muy dichosos cuando tengan que enfrentarse con diversas pruebas, pues ya saben que la prueba de su fe produce constancia.',
    ref: { ko: '야고보서 1:2-3', en: 'James 1:2-3', es: 'Santiago 1:2-3' },
  },
  // 49
  {
    ko: '내가 산을 향하여 눈을 들리라 나의 도움이 어디서 올까 나의 도움은 천지를 지으신 여호와에게서로다.',
    en: 'I lift up my eyes to the mountains — where does my help come from? My help comes from the Lord, the Maker of heaven and earth.',
    es: 'A las montañas levanto mis ojos; ¿de dónde ha de venir mi ayuda? Mi ayuda proviene del Señor, creador del cielo y de la tierra.',
    ref: { ko: '시편 121:1-2', en: 'Psalm 121:1-2', es: 'Salmo 121:1-2' },
  },
  // 50
  {
    ko: '그러나 여호와여 주는 우리 아버지시니이다 우리는 진흙이요 주는 토기장이시니 우리는 다 주의 손으로 지으신 것이니이다.',
    en: 'Yet you, Lord, are our Father. We are the clay, you are the potter; we are all the work of your hand.',
    es: 'Sin embargo, Señor, tú eres nuestro Padre; nosotros somos el barro, y tú el alfarero. Todos somos obra de tu mano.',
    ref: { ko: '이사야 64:8', en: 'Isaiah 64:8', es: 'Isaías 64:8' },
  },
  // 51
  {
    ko: '내가 사망의 음침한 골짜기로 다닐지라도 해를 두려워하지 않을 것은 주께서 나와 함께 하심이라 주의 지팡이와 막대기가 나를 안위하시나이다.',
    en: 'Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.',
    es: 'Aun si voy por valles tenebrosos, no temo peligro alguno porque tú estás a mi lado; tu vara de pastor me reconforta.',
    ref: { ko: '시편 23:4', en: 'Psalm 23:4', es: 'Salmo 23:4' },
  },
  // 52
  {
    ko: '그러므로 너희는 가서 모든 민족을 제자로 삼아 아버지와 아들과 성령의 이름으로 세례를 베풀고 내가 너희에게 분부한 모든 것을 가르쳐 지키게 하라 볼지어다 내가 세상 끝날까지 너희와 항상 함께 있으리라.',
    en: 'Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, and teaching them to obey everything I have commanded you. And surely I am with you always, to the very end of the age.',
    es: 'Por tanto, vayan y hagan discípulos de todas las naciones, bautizándolos en el nombre del Padre y del Hijo y del Espíritu Santo, enseñándoles a obedecer todo lo que les he mandado a ustedes. Y les aseguro que estaré con ustedes siempre, hasta el fin del mundo.',
    ref: { ko: '마태복음 28:19-20', en: 'Matthew 28:19-20', es: 'Mateo 28:19-20' },
  },
];

const WEEKDAY_LABELS: Record<string, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  es: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
};

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavigationProp>();
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();

  const [dbAnnouncements, setDbAnnouncements] = useState<Announcement[] | null>(null);
  const [verseData, setVerseData] = useState<{ ko: string; en: string; es: string; ref: string; ref_en?: string; ref_es?: string } | null>(null);
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % CURATED_VERSES.length;

  // Announcement expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // 화면에 포커스될 때마다 말씀·공지 갱신 (관리자 저장 후 바로 반영)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const { data } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(3);
          if (data) setDbAnnouncements(data as Announcement[]);
        } catch { /* ignore */ }
      })();

      (async () => {
        try {
          const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'weekly_verse')
            .single();
          if (data?.value) {
            const v = JSON.parse(data.value);
            if (v.ko || v.en) setVerseData({ ko: v.ko ?? '', en: v.en ?? '', es: v.es ?? '', ref: v.ref ?? '', ref_en: v.ref_en, ref_es: v.ref_es });
            else setVerseData(null); // DB 비어있으면 curated로 fallback
          } else {
            setVerseData(null);
          }
        } catch { /* ignore, fall back to curated */ }
      })();
    }, [])
  );

  // Fetch events when calendar month changes
  useEffect(() => {
    const startDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
    const endDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let cancelled = false;
    setEventsLoading(true);

    const timeout = new Promise<{ data: null }>(resolve =>
      setTimeout(() => resolve({ data: null }), 15000)
    );

    const query = supabase
      .from('events')
      .select('id, title, date, time, location, description')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    Promise.race([query, timeout])
      .then(({ data }) => {
        if (!cancelled) setEvents((data as CalendarEvent[]) ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

    return () => { cancelled = true; };
  }, [calYear, calMonth]);

  const l = lang as 'ko' | 'en' | 'es';
  const currentVerse = verseData ? verseData : CURATED_VERSES[weekIndex];

  function getVerseText(): string {
    return currentVerse[l] ?? currentVerse.ko;
  }

  function getVerseRef(): string {
    if (verseData) {
      if (l === 'en' && verseData.ref_en) return verseData.ref_en;
      if (l === 'es' && verseData.ref_es) return verseData.ref_es;
      return verseData.ref;
    }
    return CURATED_VERSES[weekIndex].ref[l] ?? CURATED_VERSES[weekIndex].ref.ko;
  }

  const announcements = [
    { id: '1', titleKey: 'homeAnn1Title' as const, bodyKey: 'homeAnn1Body' as const, date: ANNOUNCEMENT_DATES[0] },
    { id: '2', titleKey: 'homeAnn2Title' as const, bodyKey: 'homeAnn2Body' as const, date: ANNOUNCEMENT_DATES[1] },
    { id: '3', titleKey: 'homeAnn3Title' as const, bodyKey: 'homeAnn3Body' as const, date: ANNOUNCEMENT_DATES[2] },
  ];

  // Calendar helpers
  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else { setCalMonth(m => m - 1); }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else { setCalMonth(m => m + 1); }
    setSelectedDate(null);
  }

  function buildCalendarDays(): (number | null)[] {
    const firstDow = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function dateString(day: number): string {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function hasEvent(day: number): boolean {
    const ds = dateString(day);
    return events.some(e => e.date === ds);
  }

  const calDays = buildCalendarDays();
  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  const MONTH_NAMES_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  function getMonthTitle(): string {
    if (lang === 'ko') return `${calYear}년 ${MONTH_NAMES_KO[calMonth]}`;
    const date = new Date(calYear, calMonth, 1);
    const locale = lang === 'es' ? 'es-ES' : 'en-US';
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* 이번주 말씀 배너 */}
        <View style={styles.verseCard}>
          <Text style={styles.verseLabel}>{t('homeWeeklyVerse')}</Text>
          <Text style={styles.verseText}>{getVerseText()}</Text>
          <Text style={styles.verseRef}>{getVerseRef()}</Text>
        </View>

        {/* 공지사항 */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t('homeAnnouncements')}</Text>
        </View>
        <View style={styles.announcementsCard}>
          {((dbAnnouncements && dbAnnouncements.length > 0) ? dbAnnouncements : announcements.map(a => ({
            id: a.id,
            title_ko: t(a.titleKey), title_en: t(a.titleKey), title_es: t(a.titleKey),
            body_ko: t(a.bodyKey), body_en: t(a.bodyKey), body_es: t(a.bodyKey),
            created_at: a.date,
          } as Announcement))).map((item, index, arr) => {
            const title = (l === 'en' ? item.title_en : l === 'es' ? item.title_es : item.title_ko) || item.title_ko;
            const body = (l === 'en' ? item.body_en : l === 'es' ? item.body_es : item.body_ko) || item.body_ko;
            const dateStr = item.created_at?.slice(5, 10) ?? '';
            const isExpanded = expandedId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.announcementItem,
                  index < arr.length - 1 && styles.announcementBorder,
                ]}
                activeOpacity={0.7}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <View style={styles.announcementDot} />
                <View style={styles.announcementContent}>
                  <Text style={styles.announcementTitle}>{title}</Text>
                  {isExpanded && (
                    <Text style={styles.announcementBody}>{body}</Text>
                  )}
                </View>
                <Text style={styles.announcementDate}>{dateStr}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 캘린더 */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {t('calendarTitle')}
          </Text>
        </View>
        <View style={styles.calSection}>
          {/* Month navigation */}
          <View style={styles.calHeader}>
            <TouchableOpacity style={styles.calNavBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Text style={styles.calNavBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthTitle}>
              {getMonthTitle()}
            </Text>
            <TouchableOpacity style={styles.calNavBtn} onPress={nextMonth} activeOpacity={0.7}>
              <Text style={styles.calNavBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.calWeekRow}>
            {(WEEKDAY_LABELS[lang] ?? WEEKDAY_LABELS.ko).map(day => (
              <View key={day} style={styles.calDayCell}>
                <Text style={[styles.calDayNum, styles.calWeekLabel]}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          {eventsLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.calGrid}>
              {calDays.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.calDayCell} />;
                }
                const ds = dateString(day);
                const isSelected = selectedDate === ds;
                const hasEv = hasEvent(day);
                const isToday =
                  day === today.getDate() &&
                  calMonth === today.getMonth() &&
                  calYear === today.getFullYear();
                return (
                  <TouchableOpacity
                    key={ds}
                    style={styles.calDayCell}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDate(isSelected ? null : ds)}
                  >
                    <View style={[
                      styles.calDayNumWrap,
                      isSelected && styles.calDayNumWrapSelected,
                      isToday && !isSelected && styles.calDayNumWrapToday,
                    ]}>
                      <Text style={[
                        styles.calDayNum,
                        isSelected && styles.calDayNumSelected,
                        isToday && !isSelected && styles.calDayNumToday,
                      ]}>{day}</Text>
                    </View>
                    {hasEv && <View style={styles.calDayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Selected day events */}
          {selectedDate && (
            <View style={styles.calEventList}>
              {selectedEvents.length === 0 ? (
                <Text style={styles.calNoEvents}>{t('calNoEvents')}</Text>
              ) : (
                selectedEvents.map(ev => (
                  <View key={ev.id} style={styles.calEventCard}>
                    <Text style={styles.calEventTitle}>{ev.title}</Text>
                    {ev.time && <Text style={styles.calEventMeta}>{ev.time}</Text>}
                    {ev.location && <Text style={styles.calEventMeta}>{ev.location}</Text>}
                    {ev.description && <Text style={styles.calEventDesc}>{ev.description}</Text>}
                  </View>
                ))
              )}
            </View>
          )}

          {!selectedDate && events.length === 0 && !eventsLoading && (
            <Text style={styles.calNoEvents}>
              {lang === 'en' ? 'No scheduled events' : lang === 'es' ? 'No hay eventos programados' : '등록된 일정이 없습니다'}
            </Text>
          )}
        </View>

        {/* 기도 요청 */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Prayer')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#E8F4FF' }]}>
            <Icon name="action-prayer" size={26} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>
              {lang === 'en' ? 'Prayer Request' : lang === 'es' ? 'Petición de Oración' : '기도 요청'}
            </Text>
            <Text style={styles.actionDesc}>
              {lang === 'en' ? 'Submit a prayer request to our team' : lang === 'es' ? 'Envía una petición de oración' : '기도 제목을 나눠주세요'}
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        {/* 심방 요청 */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Visit')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#FFF4E8' }]}>
            <Icon name="action-visit" size={26} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>
              {lang === 'en' ? 'Pastoral Visit Request' : lang === 'es' ? 'Solicitud de Visita Pastoral' : '심방 요청'}
            </Text>
            <Text style={styles.actionDesc}>
              {lang === 'en' ? 'Request a visit from our pastoral team' : lang === 'es' ? 'Solicita una visita de nuestro equipo pastoral' : '목사님 심방을 요청하세요'}
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        {/* 봉사 신청 */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Volunteer')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#F0FFF4' }]}>
            <Icon name="action-volunteer" size={26} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>
              {lang === 'en' ? 'Volunteer Sign-up' : lang === 'es' ? 'Inscripción de Voluntarios' : '봉사 신청'}
            </Text>
            <Text style={styles.actionDesc}>
              {lang === 'en' ? 'Sign up to serve in our ministries' : lang === 'es' ? 'Regístrate para servir en nuestros ministerios' : '교회 사역에 함께 참여해 주세요'}
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        {/* 설교 요약 */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('SermonSummary')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#F5F3FF' }]}>
            <Icon name="action-sermon" size={26} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>
              {lang === 'en' ? 'Sermon Summary' : lang === 'es' ? 'Resumen del Sermón' : '설교 요약'}
            </Text>
            <Text style={styles.actionDesc}>
              {lang === 'en' ? "This week's sermon in 3 languages" : lang === 'es' ? 'El sermón de esta semana en 3 idiomas' : '이번 주 설교를 3개국어로 확인하세요'}
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
  },
  logoImage: {
    width: 240,
    height: 72,
  },
  verseCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  verseLabel: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  verseText: {
    color: Colors.white,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
  },
  verseRef: {
    color: Colors.secondary,
    fontSize: 13,
    marginTop: 12,
    fontWeight: '700',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 10,
  },
  announcementsCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  announcementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  announcementBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  announcementDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.secondary,
    marginRight: 12,
    marginTop: 4,
    flexShrink: 0,
  },
  announcementContent: {
    flex: 1,
    marginRight: 8,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  announcementBody: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginTop: 4,
  },
  announcementDate: {
    fontSize: 11,
    color: Colors.text.light,
    flexShrink: 0,
    marginTop: 2,
  },

  // ── 캘린더
  calSection: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  calNavBtnText: {
    fontSize: 22,
    color: Colors.primary,
    lineHeight: 26,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: '14.285714%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  calDayNumWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayNumWrapSelected: {
    backgroundColor: Colors.primary,
  },
  calDayNumWrapToday: {
    backgroundColor: Colors.secondary + '33',
  },
  calDayNum: {
    fontSize: 13,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  calDayNumSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  calDayNumToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  calDayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
    marginTop: 2,
  },
  calEventList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  calEventCard: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  calEventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  calEventMeta: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  calEventDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 17,
  },
  calNoEvents: {
    fontSize: 13,
    color: Colors.text.light,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // ── 기도 / 심방 요청 카드
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginBottom: 3 },
  actionDesc: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17 },
  actionArrow: { fontSize: 22, color: Colors.text.light, marginLeft: 8 },
});
