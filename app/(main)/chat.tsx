import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  GestureResponderEvent,
  Modal,
  ScrollView,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { useThemeStore } from "../../store/useThemeStore";
import { sendMessage, generateWelcome } from "../../lib/chatEngine";
import { analyzeFoodFromText } from "../../lib/foodAnalyzer";
import { QUICK_ACTIONS } from "../../lib/types";
import type { DietPlanData, ConversationItem, PinnedMessage, FoodAnalysisResult } from "../../lib/types";
import { THEMES } from "../../lib/theme";
import DietPlanCardComponent from "../../components/DietPlanCard";
import CalorieLogCard from "../../components/CalorieLogCard";
import ChatSidebar from "../../components/ChatSidebar";
import FoodLogModal from "../../components/FoodLogModal";
import VoiceMode from "../../components/VoiceMode";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Theme colors imported from ../../lib/theme

// ── Quick action icon mapping ────────────────────────────────
const QUICK_ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Get Diet Plan": "nutrition-outline",
  "Track Calories": "analytics-outline",
  "Log Food": "restaurant-outline",
  "Order Food": "fast-food-outline",
};

const QUICK_ACTION_DESCS: Record<string, string> = {
  "Get Diet Plan": "AI-powered 7-day meal plan for you",
  "Track Calories": "Snap a photo to track your meal",
  "Log Food": "Type or click to log what you ate",
  "Order Food": "Get healthy food suggestions to order",
};

// ── Display types ──────────────────────────────────────────────
interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  replyTo?: { id: string; content: string };
}

interface DietCardItem {
  id: string;
  type: "diet_card";
  plan: DietPlanData;
  created_at: string;
}

type FlatListItem = DisplayMessage | DietCardItem;

function isDietCard(item: FlatListItem): item is DietCardItem {
  return "type" in item && item.type === "diet_card";
}

// ── Typing dots ─────────────────────────────────────────────────
function Dot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[style, { width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginHorizontal: 2 }]}
    />
  );
}

function TypingIndicator({ colors }: { colors: typeof THEMES.dark }) {
  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 12, alignItems: "flex-start" }}>
      <View style={{ backgroundColor: colors.typingBg, borderRadius: 16, borderTopLeftRadius: 0, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" }}>
        <Dot delay={0} color={colors.dotBg} />
        <Dot delay={200} color={colors.dotBg} />
        <Dot delay={400} color={colors.dotBg} />
      </View>
    </View>
  );
}

// ── Typewriter reveal ───────────────────────────────────────────
function useTypewriter(fullText: string, speed: number = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!fullText) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [fullText]);

  return { displayed, done };
}

// ── Food log parser ─────────────────────────────────────────────
const FOOD_LOG_PREFIX = "FOOD_LOG:";

function tryParseFoodLog(text: string): FoodAnalysisResult | null {
  if (!text.startsWith(FOOD_LOG_PREFIX)) return null;
  try {
    const json = text.slice(FOOD_LOG_PREFIX.length);
    const parsed = JSON.parse(json);
    if (parsed?.food_name && parsed?.calories != null) return parsed as FoodAnalysisResult;
  } catch {}
  return null;
}

// ── Message bubble ──────────────────────────────────────────────
function tryParseDietPlanFromText(text: string): DietPlanData | null {
  if (!text.includes('"type"') || !text.includes("DIET_PLAN")) return null;
  const match = text.match(/(\{[\s\S]*"type"\s*:\s*"DIET_PLAN"[\s\S]*)/);
  if (!match) return null;
  const fragment = match[1];
  let depth = 0;
  let jsonEnd = -1;
  for (let i = 0; i < fragment.length; i++) {
    if (fragment[i] === "{") depth++;
    else if (fragment[i] === "}") {
      depth--;
      if (depth === 0) { jsonEnd = i; break; }
    }
  }
  if (jsonEnd === -1) return null;
  try {
    const cleaned = fragment.slice(0, jsonEnd + 1).replace(/[\n\r\t]/g, "").replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    const parsed = JSON.parse(cleaned);
    if (parsed?.type === "DIET_PLAN" && parsed?.days) return parsed as DietPlanData;
  } catch {}
  return null;
}

function MessageBubble({
  item,
  isPinned,
  onLongPress,
  colors,
}: {
  item: DisplayMessage;
  isPinned?: boolean;
  onLongPress?: (e: GestureResponderEvent) => void;
  colors: typeof THEMES.dark;
}) {
  const isUser = item.role === "user";

  if (!isUser) {
    const embeddedPlan = tryParseDietPlanFromText(item.content);
    if (embeddedPlan) {
      return (
        <Pressable onPress={Keyboard.dismiss} onLongPress={onLongPress} delayLongPress={400}>
          <DietPlanCardComponent
            plan={embeddedPlan}
            isPinned={isPinned}
          />
        </Pressable>
      );
    }
  }

  return (
    <Pressable
      onPress={Keyboard.dismiss}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{ paddingHorizontal: 20, marginBottom: 10, alignItems: isUser ? "flex-end" : "flex-start" }}
    >
      {item.replyTo && (
        <View style={{
          maxWidth: "80%",
          paddingLeft: 10,
          marginBottom: 4,
          borderLeftWidth: 2,
          borderLeftColor: colors.accent,
          alignSelf: isUser ? "flex-end" : "flex-start",
        }}>
          <Text style={{ color: colors.subText, fontSize: 12 }} numberOfLines={1}>
            {item.replyTo.content}
          </Text>
        </View>
      )}
      <View
        style={[
          {
            maxWidth: "80%",
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: isUser ? colors.bubbleUser : colors.bubbleBot,
          },
          isUser
            ? { borderBottomRightRadius: 4 }
            : { borderBottomLeftRadius: 4 },
          isPinned ? { borderWidth: 1, borderColor: colors.accent } : undefined,
        ]}
      >
        {isPinned && (
          <Text style={{ color: colors.accent, fontSize: 10, marginBottom: 2 }}>
            {"\uD83D\uDCCC"} Pinned
          </Text>
        )}
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: isUser ? colors.bubbleUserText : colors.bubbleBotText,
          }}
        >
          {item.content}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Swipeable message wrapper ────────────────────────────────────
function SwipeableMessage({
  children,
  onSwipeReply,
}: {
  children: React.ReactNode;
  onSwipeReply: () => void;
}) {
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const triggerReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSwipeReply();
  }, [onSwipeReply]);

  const pan = Gesture.Pan()
    .activeOffsetX(15)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX * 0.6, 80);
        if (translateX.value >= 50 && !hasTriggered.value) {
          hasTriggered.value = true;
          runOnJS(triggerReply)();
        }
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      hasTriggered.value = false;
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / 50, 1),
    transform: [{ scale: Math.min(translateX.value / 50, 1) }],
  }));

  return (
    <View>
      <Animated.View style={[{ position: "absolute", left: 8, top: 0, bottom: 0, justifyContent: "center" }, arrowStyle]}>
        <Text style={{ color: "#A8FF3E", fontSize: 18 }}>{"\u21A9"}</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={animStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ── Draggable FAB ───────────────────────────────────────────────
const FAB_SIZE = 48;

function DraggableFAB({ onPress }: { onPress: () => void }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onPress)();
  });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
      scale.value = withSpring(1.1, { damping: 15 });
    })
    .onUpdate((e) => {
      translateX.value = offsetX.value + e.translationX;
      translateY.value = offsetY.value + e.translationY;
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 15 });
    });

  const gesture = Gesture.Race(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 16,
            right: 16,
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: "#A8FF3E",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            elevation: 5,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          },
          animStyle,
        ]}
      >
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#000" }}>Log+</Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Reply reference bubble ──────────────────────────────────────
function ReplyReference({ text }: { text: string }) {
  return (
    <View style={{
      marginHorizontal: 20,
      marginBottom: 2,
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: "#A8FF3E",
    }}>
      <Text style={{ color: "#777", fontSize: 12 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// ── Typewriter bot bubble ───────────────────────────────────────
function BotTypingBubble({
  fullText,
  onDone,
  colors,
}: {
  fullText: string;
  onDone: () => void;
  colors: typeof THEMES.dark;
}) {
  const { displayed, done } = useTypewriter(fullText, 14);

  useEffect(() => {
    if (done) onDone();
  }, [done]);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: 20, marginBottom: 10, alignItems: "flex-start" }}>
      <View style={{ maxWidth: "80%", backgroundColor: colors.bubbleBot, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.bubbleBotText }}>
          {displayed}
          {!done && <Text style={{ color: colors.accent }}>{"\u258D"}</Text>}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Pinned message banner (supports multiple) ──────────────────
function PinnedBanner({
  items,
  onTap,
  onUnpin,
  colors,
}: {
  items: FlatListItem[];
  onTap: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  colors: typeof THEMES.dark;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.pinnedBorder }}>
      {items.map((item) => {
        const previewText = isDietCard(item)
          ? "\uD83E\uDD57 Your 7-Day Plan"
          : (item as DisplayMessage).content;
        return (
          <Pressable
            key={item.id}
            onPress={() => onTap(item.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.pinnedBg,
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderBottomWidth: items.length > 1 ? 0.5 : 0,
              borderBottomColor: colors.pinnedBorder,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 12, marginRight: 8 }}>{"\uD83D\uDCCC"}</Text>
            <Text
              style={{ flex: 1, color: colors.pinnedText, fontSize: 13 }}
              numberOfLines={1}
            >
              {previewText}
            </Text>
            <Pressable onPress={() => onUnpin(item.id)} hitSlop={8}>
              <Text style={{ color: colors.subText, fontSize: 16, marginLeft: 8 }}>{"\u2715"}</Text>
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Inline food prompt ──────────────────────────────────────────
function FoodPrompt({
  onSubmit,
  onCancel,
  colors,
}: {
  onSubmit: (food: string) => void;
  onCancel: () => void;
  colors: typeof THEMES.dark;
}) {
  const [food, setFood] = useState("");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bubbleBot, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.widgetBorder }}>
      <TextInput
        value={food}
        onChangeText={setFood}
        placeholder="What did you eat?"
        placeholderTextColor={colors.inputPlaceholder}
        autoFocus
        style={{ flex: 1, color: colors.inputText, fontSize: 14, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: colors.inputBg, borderRadius: 8 }}
      />
      <Pressable
        onPress={() => food.trim() && onSubmit(food.trim())}
        style={{ marginLeft: 8, backgroundColor: colors.pinnedBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
      >
        <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 }}>Log</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={{ marginLeft: 6, paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ color: colors.subText, fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Inline water prompt ─────────────────────────────────────────
function WaterPrompt({
  onSelect,
  onCancel,
  colors,
}: {
  onSelect: (count: number) => void;
  onCancel: () => void;
  colors: typeof THEMES.dark;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bubbleBot, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.widgetBorder, gap: 8 }}>
      <Text style={{ color: colors.subText, fontSize: 13, marginRight: 4 }}>{"\uD83D\uDCA7"} Glasses:</Text>
      {[1, 2, 3, 4].map((n) => (
        <Pressable
          key={n}
          onPress={() => onSelect(n)}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? colors.pinnedBorder : colors.pinnedBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.pinnedBorder,
          })}
        >
          <Text style={{ color: colors.accent, fontWeight: "bold", fontSize: 16 }}>{n}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onCancel} style={{ marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ color: colors.subText, fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Context Menu Modal (WhatsApp-style) ─────────────────────────
function ContextMenuModal({
  visible,
  onClose,
  onReply,
  onCopy,
  onPin,
  isPinned,
  menuY,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onPin: () => void;
  isPinned: boolean;
  menuY: number;
  colors: typeof THEMES.dark;
}) {
  const options = [
    { label: "Reply", icon: "arrow-undo-outline" as keyof typeof Ionicons.glyphMap, action: onReply },
    { label: "Copy", icon: "copy-outline" as keyof typeof Ionicons.glyphMap, action: onCopy },
    { label: isPinned ? "Unpin" : "Pin", icon: "pin-outline" as keyof typeof Ionicons.glyphMap, action: onPin },
  ];

  const MENU_HEIGHT = options.length * 68 + 20; // rough estimate
  const isBottomHalf = menuY > SCREEN_H / 2;
  const clampedTop = isBottomHalf
    ? Math.max(40, menuY - MENU_HEIGHT - 10)
    : Math.min(SCREEN_H - MENU_HEIGHT - 40, menuY + 10);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            position: "absolute",
            top: clampedTop,
            alignSelf: "center",
            left: (SCREEN_W - Math.min(SCREEN_W * 0.78, 300)) / 2,
            backgroundColor: colors.contextMenuBg,
            borderRadius: 20,
            width: Math.min(SCREEN_W * 0.78, 300),
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: colors.contextMenuBorder,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {options.map((opt, i) => (
            <Pressable
              key={opt.label}
              onPress={() => {
                onClose();
                opt.action();
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 24,
                paddingVertical: 16,
                backgroundColor: pressed ? (colors === THEMES.dark ? "#2a2a2a" : "#F0F0F0") : "transparent",
                borderBottomWidth: i < options.length - 1 ? 0.5 : 0,
                borderBottomColor: colors.contextMenuBorder,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.widgetIconBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={opt.icon} size={20} color={colors.accent} />
                </View>
                <Text style={{ color: colors.contextMenuText, fontSize: 16, fontWeight: "600", marginLeft: 14 }}>
                  {opt.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main chat screen ────────────────────────────────────────────
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const { addWater, waterGlasses, saveFoodLog, loadTodayLogs } = useTrackingStore();
  const flatListRef = useRef<FlatList>(null);

  // Theme
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const colors = THEMES[mode];

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [listData, setListData] = useState<FlatListItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Bubble queue state
  const [currentBubbleText, setCurrentBubbleText] = useState<string | null>(null);
  const bubbleQueueRef = useRef<string[]>([]);
  const pendingDietPlanRef = useRef<DietPlanData | null>(null);
  const isProcessingBubblesRef = useRef(false);

  // Conversation tracking
  const conversationIdRef = useRef<string>(Crypto.randomUUID());
  const conversationCreatedRef = useRef(false);
  const welcomeSent = useRef(false);

  // Diet plan shown flag
  const dietPlanShownRef = useRef(false);

  // Pin state — multiple pins, persisted to Supabase
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set());

  // Inline prompt states
  const [showFoodPrompt, setShowFoodPrompt] = useState(false);
  const [showWaterPrompt, setShowWaterPrompt] = useState(false);
  const [showFoodLogModal, setShowFoodLogModal] = useState(false);

  // Reply state
  const [replyToMessage, setReplyToMessage] = useState<DisplayMessage | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuItem, setContextMenuItem] = useState<DisplayMessage | null>(null);
  const [contextMenuY, setContextMenuY] = useState(0);

  // Quick actions popup state
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Voice mode state
  const [showVoiceMode, setShowVoiceMode] = useState(false);

  // Smart scroll tracking
  const isNearBottomRef = useRef(true);

  const getDietPlanKey = (convId: string) => `dietPlanShown_${convId}`;

  const markDietPlanShown = async (convId: string) => {
    dietPlanShownRef.current = true;
    try {
      await AsyncStorage.setItem(getDietPlanKey(convId), "true");
    } catch {}
  };

  const loadDietPlanFlag = async (convId: string) => {
    try {
      const val = await AsyncStorage.getItem(getDietPlanKey(convId));
      dietPlanShownRef.current = val === "true";
    } catch {
      dietPlanShownRef.current = false;
    }
  };

  const userId = session?.user?.id || "";

  // Sync listData when messages change
  useEffect(() => {
    setListData([...messages]);
  }, [messages]);

  // ── Load chat history + food logs on mount ──────────────────
  useEffect(() => {
    if (!userId) return;
    loadLatestConversation();
    loadTodayLogs(userId);
  }, [userId]);

  const loadLatestConversation = async () => {
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        const latestConv = convs[0];
        conversationIdRef.current = latestConv.id;
        conversationCreatedRef.current = true;
        await loadDietPlanFlag(latestConv.id);
        loadPinnedMessages(latestConv.id);

        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("user_id", userId)
          .eq("conversation_id", latestConv.id)
          .order("created_at", { ascending: true })
          .limit(50);

        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setLoadingHistory(false);
          return;
        }
      }

      setLoadingHistory(false);
      sendWelcome();
    } catch {
      setLoadingHistory(false);
      sendWelcome();
    }
  };

  // ── Create conversation in DB ──────────────────────────────
  const ensureConversation = async (title: string) => {
    if (conversationCreatedRef.current || !userId) return;
    conversationCreatedRef.current = true;
    try {
      const { error } = await supabase.from("conversations").insert({
        id: conversationIdRef.current,
        user_id: userId,
        title: title.slice(0, 40),
      });
      if (error) console.warn("[DB] Create conversation failed:", error.message);
      else console.log("[DB] Conversation created:", conversationIdRef.current);
    } catch (e) {
      console.warn("[DB] Create conversation error:", e);
    }
  };

  // ── Welcome message ────────────────────────────────────────
  const sendWelcome = async () => {
    if (welcomeSent.current || !userId) return;
    welcomeSent.current = true;
    setShowTypingIndicator(true);

    try {
      const welcomeText = await generateWelcome(userId);
      setShowTypingIndicator(false);

      const welcomeId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: welcomeId,
        role: "assistant",
        content: welcomeText,
        created_at: new Date().toISOString(),
      };

      setMessages([botMsg]);
      setCurrentBubbleText(welcomeText);
      saveMessage("assistant", welcomeText, welcomeId);
    } catch {
      setShowTypingIndicator(false);
      const fallbackMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "yo bhai! kya scene hai? health related kuch bhi puchna ho toh bol \uD83D\uDCAA",
        created_at: new Date().toISOString(),
      };
      setMessages([fallbackMsg]);
    }
  };

  // ── New chat ───────────────────────────────────────────────
  const handleNewChat = () => {
    if (isLoading) return;

    conversationIdRef.current = Crypto.randomUUID();
    conversationCreatedRef.current = false;
    dietPlanShownRef.current = false;

    setMessages([]);
    setListData([]);
    setCurrentBubbleText(null);
    bubbleQueueRef.current = [];
    pendingDietPlanRef.current = null;
    isProcessingBubblesRef.current = false;
    setShowTypingIndicator(false);
    setPinnedMessageIds(new Set());
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);
    setShowFoodLogModal(false);
    setReplyToMessage(null);

    welcomeSent.current = false;
    sendWelcome();
  };

  // ── Load a specific conversation ───────────────────────────
  const handleSelectConversation = async (conv: ConversationItem) => {
    if (isLoading) return;

    conversationIdRef.current = conv.id;
    conversationCreatedRef.current = true;
    await loadDietPlanFlag(conv.id);

    setMessages([]);
    setListData([]);
    setCurrentBubbleText(null);
    bubbleQueueRef.current = [];
    pendingDietPlanRef.current = null;
    isProcessingBubblesRef.current = false;
    setShowTypingIndicator(false);
    setPinnedMessageIds(new Set());
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);
    setShowFoodLogModal(false);
    setReplyToMessage(null);

    loadPinnedMessages(conv.id);

    try {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (msgs && msgs.length > 0) {
        setMessages(msgs);
      }
    } catch {}
  };

  // ── Save message to DB ─────────────────────────────────────
  const saveMessage = async (role: "user" | "assistant", content: string, msgId?: string) => {
    if (!userId) return;
    try {
      const row: Record<string, string> = {
        user_id: userId,
        role,
        content,
        conversation_id: conversationIdRef.current,
      };
      if (msgId) row.id = msgId;
      const { error } = await supabase.from("messages").insert(row);
      if (error) console.warn("[DB] Save message failed:", error.message);
      else console.log("[DB] Message saved:", role, content.slice(0, 40));
    } catch (e) {
      console.warn("[DB] Save message error:", e);
    }
  };

  // ── Scroll helpers ─────────────────────────────────────────
  const scrollToEnd = useCallback(() => {
    if (isNearBottomRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    }
  }, []);

  const forceScrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    isNearBottomRef.current = distanceFromBottom < 120;
  }, []);

  // ── Handle personalize button ──────────────────────────────
  const handlePersonalize = useCallback(() => {
    handleSend("yes, customize my diet plan");
  }, []);

  // ── Load pinned messages from Supabase ──────────────────────
  const loadPinnedMessages = useCallback(async (convId: string) => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("pinned_messages")
        .select("message_id")
        .eq("conversation_id", convId)
        .eq("user_id", userId);
      if (data) {
        setPinnedMessageIds(new Set(data.map((r: { message_id: string }) => r.message_id)));
      } else {
        setPinnedMessageIds(new Set());
      }
    } catch {
      setPinnedMessageIds(new Set());
    }
  }, [userId]);

  // ── Pin / unpin a message (persisted) with 2-pin limit ────
  const handlePinMessage = useCallback(async (messageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const convId = conversationIdRef.current;
    const wasPinned = pinnedMessageIds.has(messageId);

    // Enforce 2-pin limit
    if (!wasPinned && pinnedMessageIds.size >= 2) {
      Alert.alert("Pin Limit", "You can only pin up to 2 messages per chat. Unpin one first.");
      return;
    }

    // Optimistic update
    setPinnedMessageIds((prev) => {
      const next = new Set(prev);
      if (wasPinned) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });

    try {
      if (wasPinned) {
        const { error } = await supabase
          .from("pinned_messages")
          .delete()
          .eq("conversation_id", convId)
          .eq("message_id", messageId)
          .eq("user_id", userId);
        if (error) {
          console.warn("[Pin] Unpin failed:", error.message);
          throw error;
        }
        console.log("[Pin] Unpinned:", messageId);
      } else {
        const { error } = await supabase
          .from("pinned_messages")
          .upsert({
            conversation_id: convId,
            message_id: messageId,
            user_id: userId,
          }, { onConflict: "conversation_id,message_id" });
        if (error) {
          console.warn("[Pin] Pin failed:", error.message);
          throw error;
        }
        console.log("[Pin] Pinned:", messageId);
      }
    } catch {
      // Revert on failure
      setPinnedMessageIds((prev) => {
        const reverted = new Set(prev);
        if (wasPinned) reverted.add(messageId);
        else reverted.delete(messageId);
        return reverted;
      });
    }
  }, [pinnedMessageIds, userId]);

  const handleUnpinMessage = useCallback(async (messageId: string) => {
    const convId = conversationIdRef.current;
    setPinnedMessageIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    try {
      await supabase
        .from("pinned_messages")
        .delete()
        .eq("conversation_id", convId)
        .eq("message_id", messageId)
        .eq("user_id", userId);
    } catch {}
  }, [userId]);

  const handleScrollToPinned = useCallback((messageId: string) => {
    const index = listData.findIndex((item) => item.id === messageId);
    if (index >= 0) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }
  }, [listData]);

  // Resolve pinned items for the banner (messages + diet cards)
  const pinnedItems: FlatListItem[] = listData.filter(
    (item) => pinnedMessageIds.has(item.id)
  );

  // ── Swipe to reply handler ─────────────────────────────────
  const handleSwipeReply = useCallback((item: DisplayMessage) => {
    setReplyToMessage(item);
    inputRef.current?.focus();
  }, []);

  // ── Context menu handlers ─────────────────────────────────
  const handleLongPress = useCallback((item: DisplayMessage, event: GestureResponderEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { pageY } = event.nativeEvent;
    setContextMenuY(pageY);
    setContextMenuItem(item);
    setContextMenuVisible(true);
  }, []);

  const handleContextReply = useCallback(() => {
    if (contextMenuItem) {
      handleSwipeReply(contextMenuItem);
    }
  }, [contextMenuItem, handleSwipeReply]);

  const handleContextCopy = useCallback(async () => {
    if (contextMenuItem) {
      await Clipboard.setStringAsync(contextMenuItem.content);
    }
  }, [contextMenuItem]);

  const handleContextPin = useCallback(() => {
    if (contextMenuItem) {
      handlePinMessage(contextMenuItem.id);
    }
  }, [contextMenuItem, handlePinMessage]);

  // ── Logout handler ─────────────────────────────────────────
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    logout();
    router.replace("/(auth)");
  };

  // ── Process bubble queue ───────────────────────────────────
  const processBubbleQueue = useCallback(() => {
    if (isProcessingBubblesRef.current) return;
    if (bubbleQueueRef.current.length === 0) {
      if (pendingDietPlanRef.current) {
        const plan = pendingDietPlanRef.current;
        pendingDietPlanRef.current = null;
        setListData((prev) => [
          ...prev,
          {
            id: `diet-${Date.now()}`,
            type: "diet_card" as const,
            plan,
            created_at: new Date().toISOString(),
          },
        ]);
        scrollToEnd();
      }
      setIsLoading(false);
      return;
    }

    isProcessingBubblesRef.current = true;
    const nextText = bubbleQueueRef.current.shift()!;

    setShowTypingIndicator(true);
    scrollToEnd();

    setTimeout(() => {
      setShowTypingIndicator(false);

      const botMsgId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: botMsgId,
        role: "assistant",
        content: nextText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      saveMessage("assistant", nextText, botMsgId);
      setCurrentBubbleText(nextText);
      scrollToEnd();
    }, 700);
  }, [scrollToEnd]);

  const handleBubbleDone = useCallback(() => {
    setCurrentBubbleText(null);
    isProcessingBubblesRef.current = false;

    setTimeout(() => {
      processBubbleQueue();
    }, 200);
  }, [processBubbleQueue]);

  // ── Send message ───────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const rawContent = (text ?? input).trim();
    if (!rawContent || isLoading) return;

    Keyboard.dismiss();
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);

    // Prepend quoted reply text for AI context
    const replyRef = replyToMessage;
    const content = replyRef
      ? `> ${replyRef.content.slice(0, 120)}\n\n${rawContent}`
      : rawContent;

    const userMsgId = Crypto.randomUUID();
    const userMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: rawContent,
      created_at: new Date().toISOString(),
      replyTo: replyRef ? { id: replyRef.id, content: replyRef.content.slice(0, 80) } : undefined,
    };

    setReplyToMessage(null);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setShowTypingIndicator(true);
    setCurrentBubbleText(null);
    forceScrollToEnd();

    ensureConversation(rawContent);
    saveMessage("user", content, userMsgId);

    const messageHistory = messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      const response = await sendMessage(
        userId,
        conversationIdRef.current,
        content,
        messageHistory,
        dietPlanShownRef.current
      );

      setShowTypingIndicator(false);

      if (response.dietPlan) {
        pendingDietPlanRef.current = response.dietPlan;
        markDietPlanShown(conversationIdRef.current);
      }

      bubbleQueueRef.current = [...response.bubbles];
      isProcessingBubblesRef.current = false;
      processBubbleQueue();
    } catch {
      setShowTypingIndicator(false);
      setIsLoading(false);
      const errMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "arre yaar connection issue lag raha hai \uD83D\uDE05 internet check karke try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  // ── Quick action handlers ──────────────────────────────────
  const handleQuickAction = (label: string) => {
    switch (label) {
      case "Log Food":
        setShowWaterPrompt(false);
        setShowFoodPrompt(false);
        setShowFoodLogModal(true);
        break;
      case "Get Diet Plan": {
        const dietIndex = listData.findIndex((item) => isDietCard(item));
        if (dietIndex >= 0) {
          flatListRef.current?.scrollToIndex({ index: dietIndex, animated: true, viewPosition: 0.3 });
        } else {
          handleSend("give me a diet plan");
        }
        break;
      }
      case "Track Calories":
        router.push("/(main)/track-food" as any);
        break;
      case "Order Food":
        handleSend("Suggest me some healthy food I can order online right now");
        break;
      default:
        handleSend(label);
    }
  };

  const handleFoodSubmit = async (food: string) => {
    setShowFoodPrompt(false);
    try {
      setIsLoading(true);
      setShowTypingIndicator(true);

      const foodUserMsgId = Crypto.randomUUID();
      const userMsg: DisplayMessage = {
        id: foodUserMsgId,
        role: "user",
        content: `I ate: ${food}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      forceScrollToEnd();
      ensureConversation(food);
      saveMessage("user", `I ate: ${food}`, foodUserMsgId);

      const result = await analyzeFoodFromText(food);
      await saveFoodLog(userId, result);

      setShowTypingIndicator(false);

      // Store as FOOD_LOG: JSON so MessageBubble renders CalorieLogCard
      const cardContent = `${FOOD_LOG_PREFIX}${JSON.stringify(result)}`;
      const foodBotMsgId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: foodBotMsgId,
        role: "assistant",
        content: cardContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      saveMessage("assistant", cardContent, foodBotMsgId);
      scrollToEnd();
    } catch {
      setShowTypingIndicator(false);
      const errMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "arre yaar food analyze nahi ho paya \uD83D\uDE05 try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFoodAnalyzed = async (result: FoodAnalysisResult, imageUri?: string) => {
    try {
      setIsLoading(true);
      setShowTypingIndicator(true);
      forceScrollToEnd();

      await saveFoodLog(userId, result, imageUri);

      setShowTypingIndicator(false);

      // Store as FOOD_LOG: JSON so MessageBubble renders CalorieLogCard
      const cardContent = `${FOOD_LOG_PREFIX}${JSON.stringify(result)}`;
      const analyzeBotId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: analyzeBotId,
        role: "assistant",
        content: cardContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      ensureConversation(result.food_name);
      saveMessage("assistant", cardContent, analyzeBotId);
      scrollToEnd();
    } catch {
      setShowTypingIndicator(false);
      const errMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "food save nahi ho paya bhai \uD83D\uDE15 try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWaterSelect = (count: number) => {
    setShowWaterPrompt(false);
    addWater(count);
    const total = waterGlasses + count;
    handleSend(`I just drank ${count} glass${count > 1 ? "es" : ""} of water. Total today: ${total} glasses.`);
  };

  // ── Voice message handler ──────────────────────────────────
  const handleVoiceMessages = useCallback((userText: string, botText: string) => {
    const userMsgId = Crypto.randomUUID();
    const botMsgId = Crypto.randomUUID();
    const now = new Date().toISOString();

    const userMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: userText,
      created_at: now,
    };
    const botMsg: DisplayMessage = {
      id: botMsgId,
      role: "assistant",
      content: botText,
      created_at: new Date(Date.now() + 1000).toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    ensureConversation(userText);
    saveMessage("user", userText, userMsgId);
    saveMessage("assistant", botText, botMsgId);
    forceScrollToEnd();
  }, []);

  // ── Loading screen ─────────────────────────────────────────
  if (loadingHistory) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.loadingBg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#A8FF3E" size="small" />
      </View>
    );
  }

  const lastMsg = messages[messages.length - 1];
  const isLastBubbleTyping =
    currentBubbleText !== null &&
    lastMsg?.role === "assistant" &&
    lastMsg?.content === currentBubbleText;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
      >
        {/* Header */}
        <Pressable
          onPress={Keyboard.dismiss}
          style={{
            paddingTop: insets.top + 6,
            paddingHorizontal: 20,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.headerBorder,
            backgroundColor: colors.headerBg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={() => setSidebarOpen(true)}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="menu" size={22} color={colors.subText} />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 17, color: colors.headerText, fontWeight: "600" }}>
                Pal {"\uD83C\uDF3F"}
              </Text>
            </View>

            {/* Dark/Light mode toggle */}
            <Pressable
              onPress={toggleMode}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons
                name={mode === "dark" ? "sunny-outline" : "moon-outline"}
                size={20}
                color={colors.subText}
              />
            </Pressable>
          </View>
        </Pressable>

        {/* Pinned message banners */}
        {pinnedItems.length > 0 && (
          <PinnedBanner
            items={pinnedItems}
            onTap={handleScrollToPinned}
            onUnpin={handleUnpinMessage}
            colors={colors}
          />
        )}

        {/* Messages + FAB container */}
        <View style={{ flex: 1 }} onTouchStart={Keyboard.dismiss}>
              <FlatList
                ref={flatListRef}
                data={listData}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => {
                  if (isDietCard(item)) {
                    return (
                      <DietPlanCardComponent
                        plan={item.plan}
                        onPersonalize={!item.plan.is_personalized ? handlePersonalize : undefined}
                        onLongPress={() => handlePinMessage(item.id)}
                        isPinned={pinnedMessageIds.has(item.id)}
                      />
                    );
                  }

                  if (
                    isLastBubbleTyping &&
                    index === listData.length - 1 &&
                    !isDietCard(item)
                  ) {
                    return (
                      <BotTypingBubble
                        fullText={currentBubbleText!}
                        onDone={handleBubbleDone}
                        colors={colors}
                      />
                    );
                  }

                  const msgItem = item as DisplayMessage;

                  // Detect food log card embedded in message
                  if (msgItem.role === "assistant") {
                    const foodResult = tryParseFoodLog(msgItem.content);
                    if (foodResult) {
                      return (
                        <CalorieLogCard
                          result={foodResult}
                          onViewDashboard={() => router.push("/(main)/dashboard" as any)}
                        />
                      );
                    }
                  }

                  return (
                    <SwipeableMessage onSwipeReply={() => handleSwipeReply(msgItem)}>
                      <MessageBubble
                        item={msgItem}
                        isPinned={pinnedMessageIds.has(item.id)}
                        onLongPress={(e) => handleLongPress(msgItem, e)}
                        colors={colors}
                      />
                    </SwipeableMessage>
                  );
                }}
                contentContainerStyle={{
                  paddingTop: 16,
                  paddingBottom: 8,
                  flexGrow: 1,
                  justifyContent: "flex-end",
                }}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                keyboardShouldPersistTaps="handled"
                onScroll={handleScroll}
                scrollEventThrottle={100}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: true,
                    });
                  }, 200);
                }}
              />

          {/* Draggable Floating Log Food FAB */}
          {messages.length > 1 && <DraggableFAB onPress={() => setShowFoodLogModal(true)} />}
        </View>

        {/* Typing indicator */}
        {showTypingIndicator && <TypingIndicator colors={colors} />}

        {/* Inline prompts */}
        {showFoodPrompt && (
          <FoodPrompt
            onSubmit={handleFoodSubmit}
            onCancel={() => setShowFoodPrompt(false)}
            colors={colors}
          />
        )}
        {showWaterPrompt && (
          <WaterPrompt
            onSelect={handleWaterSelect}
            onCancel={() => setShowWaterPrompt(false)}
            colors={colors}
          />
        )}

        {/* Bottom bar */}
        <View
          style={{
            paddingBottom: insets.bottom + 4,
            borderTopWidth: 1,
            borderTopColor: colors.headerBorder,
            backgroundColor: colors.bg,
          }}
        >
          {/* Reply preview bar */}
          {replyToMessage && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.replyBg,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderLeftWidth: 3,
              borderLeftColor: colors.accent,
              marginHorizontal: 16,
              marginBottom: 4,
              borderRadius: 8,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "600", marginBottom: 2 }}>
                  Replying to
                </Text>
                <Text style={{ color: colors.subText, fontSize: 13 }} numberOfLines={1}>
                  {replyToMessage.content}
                </Text>
              </View>
              <Pressable onPress={() => setReplyToMessage(null)} hitSlop={8}>
                <Text style={{ color: colors.subText, fontSize: 18, marginLeft: 12 }}>{"\u2715"}</Text>
              </Pressable>
            </View>
          )}

          {/* Input */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
            <View style={{
              flexDirection: "row",
              alignItems: "flex-end",
              backgroundColor: colors.inputBg,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              paddingLeft: 8,
              paddingRight: 6,
              paddingVertical: 2,
            }}>
              <Pressable
                onPress={() => setShowQuickActions(true)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 4,
                  alignSelf: "flex-end",
                }}
              >
                <Ionicons name="grid-outline" size={20} color={colors.accent} />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder="Message..."
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                maxLength={1000}
                style={{
                  flex: 1,
                  color: colors.inputText,
                  fontSize: 15,
                  paddingVertical: 10,
                  maxHeight: 96,
                }}
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={() => handleSend()}
              />
              <Pressable
                onPress={() => setShowVoiceMode(true)}
                style={{
                  marginLeft: 4,
                  marginBottom: 4,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="mic-outline" size={22} color={colors.accent} />
              </Pressable>
              <Pressable
                onPress={() => handleSend()}
                disabled={!input.trim() || isLoading}
                style={{
                  marginLeft: 2,
                  marginBottom: 4,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: input.trim() && !isLoading ? colors.sendBgActive : colors.sendBg,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: input.trim() && !isLoading ? colors.sendTextActive : colors.sendText,
                  }}
                >
                  {"\u2191"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Context menu modal */}
      <ContextMenuModal
        visible={contextMenuVisible}
        onClose={() => setContextMenuVisible(false)}
        onReply={handleContextReply}
        onCopy={handleContextCopy}
        onPin={handleContextPin}
        isPinned={contextMenuItem ? pinnedMessageIds.has(contextMenuItem.id) : false}
        menuY={contextMenuY}
        colors={colors}
      />

      {/* Food log modal */}
      <FoodLogModal
        visible={showFoodLogModal}
        onClose={() => setShowFoodLogModal(false)}
        onTypeFood={() => setShowFoodPrompt(true)}
        onFoodAnalyzed={handleFoodAnalyzed}
      />

      {/* Quick actions popup */}
      <Modal visible={showQuickActions} transparent animationType="fade" onRequestClose={() => setShowQuickActions(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setShowQuickActions(false)}
        >
          <Pressable onPress={() => {}} style={{ paddingBottom: insets.bottom + 70, paddingHorizontal: 20 }}>
            <View
              style={{
                backgroundColor: colors.contextMenuBg,
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: colors.contextMenuBorder,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <Text style={{ color: colors.subText, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, marginLeft: 4 }}>
                Quick Actions
              </Text>
              <View style={{ gap: 8 }}>
                {QUICK_ACTIONS.map((action) => {
                  const iconName = QUICK_ACTION_ICONS[action.label] || "ellipse-outline";
                  const desc = QUICK_ACTION_DESCS[action.label] || "";
                  return (
                    <Pressable
                      key={action.label}
                      onPress={() => {
                        setShowQuickActions(false);
                        handleQuickAction(action.label);
                      }}
                      disabled={isLoading}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? colors.widgetBorder : colors.widgetBg,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.widgetBorder,
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: colors.widgetIconBg,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 14,
                        }}>
                          <Ionicons name={iconName} size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                            {action.label}
                          </Text>
                          <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            {desc}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sidebar overlay */}
      <ChatSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userId={userId}
        currentConversationId={conversationIdRef.current}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        profile={profile}
        onLogout={handleLogout}
      />

      {/* Voice mode overlay */}
      <VoiceMode
        visible={showVoiceMode}
        onClose={() => setShowVoiceMode(false)}
        userId={userId}
        conversationId={conversationIdRef.current}
        messageHistory={messages.slice(-10).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))}
        dietPlanAlreadyShown={dietPlanShownRef.current}
        onNewMessages={handleVoiceMessages}
      />
    </View>
  );
}
