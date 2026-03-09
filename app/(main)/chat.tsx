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
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { useThemeStore } from "../../store/useThemeStore";
import { sendMessage, generateWelcome, parseResponse } from "../../lib/chatEngine";
import { analyzeFoodFromText } from "../../lib/foodAnalyzer";
import { QUICK_ACTIONS } from "../../lib/types";
import type { DietPlanData, ConversationItem, PinnedMessage, FoodAnalysisResult } from "../../lib/types";
import { THEMES } from "../../lib/theme";
import DietPlanCardComponent from "../../components/DietPlanCard";
import CalorieLogCard from "../../components/CalorieLogCard";
import ChatSidebar from "../../components/ChatSidebar";
import FoodLogModal from "../../components/FoodLogModal";
import { useVoiceChat } from "../../components/VoiceMode";
import VoiceInputBar from "../../components/VoiceInputBar";
import {
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  setAudioModeAsync,
  RecordingPresets,
} from "expo-audio";
import { speechToText } from "../../lib/cartesiaService";
import { unregisterPushToken } from "../../lib/notificationService";
import { dismissCalorieNotification } from "../../lib/androidNotificationService";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Theme colors imported from ../../lib/theme

// ── Quick action icon mapping ────────────────────────────────
const QUICK_ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Diet Plan": "nutrition-outline",
  "Log Food": "camera-outline",
  "Connectors": "git-network-outline",
};

const QUICK_ACTION_DESCS: Record<string, string> = {
  "Diet Plan": "Personalized 7-day meal plan",
  "Log Food": "Photo, camera, or type it in",
  "Connectors": "Sync health data from external apps",
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

// Strip any leaked JSON / code blocks / DIET_PLAN markers from display text
function cleanBubbleText(text: string): string {
  let cleaned = text;
  // Remove DIET_PLAN: followed by JSON
  cleaned = cleaned.replace(/DIET_PLAN:\s*\{[\s\S]*$/g, "");
  // Remove code blocks containing JSON
  cleaned = cleaned.replace(/```(?:json)?\s*\{[\s\S]*?```/g, "");
  // Remove any large JSON objects (50+ chars with curly braces)
  cleaned = cleaned.replace(/\{[^{}]*"[^"]*"\s*:\s*[\s\S]{50,}\}/g, "");
  // Remove leftover ``` markers
  cleaned = cleaned.replace(/```/g, "");
  return cleaned.trim();
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
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Ionicons name="pin" size={10} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 10, marginLeft: 3 }}>Pinned</Text>
          </View>
        )}
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: isUser ? colors.bubbleUserText : colors.bubbleBotText,
          }}
        >
          {isUser ? item.content : cleanBubbleText(item.content)}
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
          ? "Your 7-Day Plan"
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
            <Ionicons name="pin" size={12} color={colors.accent} style={{ marginRight: 8 }} />
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
      <View style={{ flexDirection: "row", alignItems: "center", marginRight: 4 }}>
        <Ionicons name="water-outline" size={14} color={colors.subText} style={{ marginRight: 3 }} />
        <Text style={{ color: colors.subText, fontSize: 13 }}>Glasses:</Text>
      </View>
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

// ── Context Menu Modal (Nyra design) ─────────────────────────────
const CONTEXT_MENU_WIDTH = SCREEN_W - 64;

function ContextMenuModal({
  visible,
  onClose,
  onReply,
  onCopy,
  onPin,
  onDelete,
  isPinned,
  menuY,
  menuX,
  isUserMessage,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onPin: () => void;
  onDelete: () => void;
  isPinned: boolean;
  menuY: number;
  menuX: number;
  isUserMessage: boolean;
  colors: typeof THEMES.dark;
}) {
  const isDark = colors === THEMES.dark;

  // Theme colors matching the HTML design
  const t = {
    scrim: isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.3)",
    menuBg: isDark ? "rgba(18,18,22,0.96)" : "rgba(255,255,255,0.98)",
    menuBorder: isDark ? "rgba(255,255,255,0.09)" : "rgba(12,10,8,0.07)",
    separator: isDark ? "rgba(255,255,255,0.06)" : "rgba(12,10,8,0.06)",
    label: isDark ? "rgba(255,255,255,0.82)" : "rgba(12,10,8,0.82)",
    iconBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(12,10,8,0.05)",
    iconColor: isDark ? "rgba(255,255,255,0.45)" : "rgba(12,10,8,0.45)",
    replyIconBg: isDark ? "rgba(190,241,53,0.08)" : "rgba(12,10,8,0.07)",
    replyIconColor: isDark ? "#bef135" : "rgba(12,10,8,0.7)",
    chevron: isDark ? "rgba(255,255,255,0.2)" : "rgba(12,10,8,0.18)",
    replyChevron: isDark ? "rgba(190,241,53,0.4)" : "rgba(12,10,8,0.2)",
    deleteIconBg: isDark ? "rgba(255,80,80,0.08)" : "rgba(220,38,38,0.07)",
    deleteIconColor: isDark ? "rgba(255,100,100,0.7)" : "rgba(220,38,38,0.7)",
    deleteLabel: isDark ? "rgba(255,100,100,0.75)" : "rgba(220,38,38,0.72)",
    deleteChevron: isDark ? "rgba(255,100,100,0.35)" : "rgba(220,38,38,0.3)",
    pressed: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
  };

  const options = [
    { key: "reply", label: "Reply", icon: "arrow-undo-outline" as keyof typeof Ionicons.glyphMap, action: onReply },
    { key: "copy", label: "Copy", icon: "copy-outline" as keyof typeof Ionicons.glyphMap, action: onCopy },
    { key: "pin", label: isPinned ? "Unpin message" : "Pin message", icon: "pin-outline" as keyof typeof Ionicons.glyphMap, action: onPin },
    { key: "delete", label: "Delete", icon: "trash-outline" as keyof typeof Ionicons.glyphMap, action: onDelete },
  ];

  const ITEM_HEIGHT = 50;
  const MENU_HEIGHT = options.length * ITEM_HEIGHT;

  const isNearBottom = menuY + MENU_HEIGHT + 20 > SCREEN_H;
  const clampedTop = isNearBottom
    ? Math.max(40, menuY - MENU_HEIGHT - 8)
    : menuY + 8;

  const menuLeft = 32;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: t.scrim }}
        onPress={onClose}
      >
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{
            position: "absolute",
            top: clampedTop,
            left: menuLeft,
            width: CONTEXT_MENU_WIDTH,
            backgroundColor: t.menuBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.menuBorder,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: isDark ? 0.5 : 0.16,
            shadowRadius: 48,
            elevation: 16,
            overflow: "hidden",
          }}
        >
          {options.map((opt, i) => {
            const isDelete = opt.key === "delete";
            const isReply = opt.key === "reply";
            const isLast = i === options.length - 1;

            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  onClose();
                  opt.action();
                }}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? t.pressed : "transparent",
                })}
              >
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  height: ITEM_HEIGHT,
                }}>
                  {/* Icon box */}
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: isDelete ? t.deleteIconBg : isReply ? t.replyIconBg : t.iconBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={isDelete ? t.deleteIconColor : isReply ? t.replyIconColor : t.iconColor}
                    />
                  </View>

                  {/* Label */}
                  <Text style={{
                    flex: 1,
                    marginLeft: 12,
                    fontSize: 14,
                    fontWeight: "400",
                    letterSpacing: -0.14,
                    color: isDelete ? t.deleteLabel : t.label,
                  }}>
                    {opt.label}
                  </Text>

                  {/* Chevron */}
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={isDelete ? t.deleteChevron : isReply ? t.replyChevron : t.chevron}
                  />
                </View>

                {/* Separator line */}
                {!isLast && (
                  <View style={{
                    height: 1,
                    marginHorizontal: 18,
                    backgroundColor: t.separator,
                  }} />
                )}
              </Pressable>
            );
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Main chat screen ────────────────────────────────────────────
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversationId: navConversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const { addWater, waterGlasses, steps, stepGoal, saveFoodLog, loadTodayLogs, getDailySummary } = useTrackingStore();
  const flatListRef = useRef<FlatList>(null);

  // Theme
  const mode = useThemeStore((s) => s.mode);
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
  const [contextMenuX, setContextMenuX] = useState(0);

  // Quick actions popup state
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Voice mode state (inline)
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [isTranscribingNote, setIsTranscribingNote] = useState(false);
  const voiceNoteRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Dashboard update toast
  const [showDashboardToast, setShowDashboardToast] = useState(false);

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

  // Sync listData when messages change — preserve diet cards
  useEffect(() => {
    setListData((prev) => {
      // Keep all existing diet cards from the current list
      const existingDietCards = prev.filter((item) => isDietCard(item));
      // Build a new list: all messages + diet cards interleaved by created_at
      const merged: FlatListItem[] = [...messages, ...existingDietCards];
      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return merged;
    });
  }, [messages]);

  // ── Load chat history + food logs on mount ──────────────────
  useEffect(() => {
    if (!userId) {
      // No user yet — show welcome instead of stuck loading
      setLoadingHistory(false);
      setShowWelcomeScreen(true);
      return;
    }
    loadLatestConversation();
    loadTodayLogs(userId);

    // Safety: force show welcome screen after 3s if stuck loading
    // Only force welcome if we haven't loaded messages yet
    const timeout = setTimeout(() => {
      setLoadingHistory((current) => {
        if (current) {
          // Still loading after 3s — force show welcome
          setShowWelcomeScreen(true);
          return false;
        }
        // Already finished loading — don't touch welcome screen
        return current;
      });
    }, 3000);
    return () => clearTimeout(timeout);
  }, [userId]);

  // ── Supabase Realtime: listen for followup messages ────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("followup-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            role: string;
            content: string;
            created_at: string;
            conversation_id: string;
            message_type?: string;
          };

          // Only handle followup messages for the current conversation
          if (
            newMsg.message_type === "followup" &&
            newMsg.conversation_id === conversationIdRef.current
          ) {
            const followupMsg: DisplayMessage = {
              id: newMsg.id,
              role: newMsg.role as "user" | "assistant",
              content: newMsg.content,
              created_at: newMsg.created_at,
            };
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, followupMsg];
            });
            forceScrollToEnd();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ── Handle notification tap navigation ────────────────────
  useEffect(() => {
    if (!navConversationId || !userId) return;
    if (navConversationId === conversationIdRef.current) return;

    // Load the conversation from the notification tap
    handleSelectConversation({ id: navConversationId, title: "", created_at: "" });
  }, [navConversationId, userId]);

  const loadLatestConversation = async () => {
    console.log("[Chat] loadLatestConversation called, userId:", userId);
    try {
      const convsResult = await Promise.race([
        supabase
          .from("conversations")
          .select("id, title, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1),
        new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), 5000)
        ),
      ]);
      const { data: convs, error: convsError } = convsResult;

      console.log("[Chat] Conversations found:", convs?.length || 0, convsError?.message || "OK");

      if (convs && convs.length > 0) {
        const latestConv = convs[0];
        conversationIdRef.current = latestConv.id;
        conversationCreatedRef.current = true;
        await loadDietPlanFlag(latestConv.id);
        loadPinnedMessages(latestConv.id);

        const { data: msgs, error: msgsError } = await supabase
          .from("messages")
          .select("id,role,content,created_at")
          .eq("user_id", userId)
          .eq("conversation_id", latestConv.id)
          .order("created_at", { ascending: true })
          .limit(100);

        console.log("[Chat] Messages loaded:", msgs?.length || 0, msgsError?.message || "OK");

        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setLoadingHistory(false);
          setShowWelcomeScreen(false);
          return;
        }
      }

      // Only show welcome screen when there are no messages
      setLoadingHistory(false);
      setShowWelcomeScreen(true);
    } catch (e) {
      console.warn("[Chat] loadLatestConversation error:", e);
      setLoadingHistory(false);
      showStaticWelcome();
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

  // ── Welcome screen state ────────────────────────────────────
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);

  const showStaticWelcome = () => {
    setShowWelcomeScreen(true);
    setLoadingHistory(false);
  };

  const handleWelcomeAction = (action: string) => {
    setShowWelcomeScreen(false);
    switch (action) {
      case "diet_plan":
        handleSend("Give me a personalized diet plan");
        break;
      case "track_calories":
        setShowFoodLogModal(true);
        break;
      case "advice":
        handleSend("Give me some health and nutrition advice");
        break;
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
    showStaticWelcome();
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
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("user_id", userId)
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) console.warn("[DB] Load conversation messages failed:", error.message);

      if (msgs && msgs.length > 0) {
        setMessages(msgs);
      }
    } catch (e) {
      console.warn("[DB] handleSelectConversation error:", e);
    }
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
    // Keep dietPlanShownRef TRUE so chatEngine takes the personalize path
    // (asks lifestyle questions instead of generating a new plan immediately)
    handleSend("I want to personalize my diet plan based on my lifestyle and routine");
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
    const { pageY, pageX } = event.nativeEvent;
    setContextMenuY(pageY);
    setContextMenuX(pageX);
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

  const handleContextDelete = useCallback(() => {
    if (!contextMenuItem) return;
    Alert.alert("Delete message", "Are you sure you want to delete this message?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setMessages((prev) => prev.filter((m) => m.id !== contextMenuItem.id));
        },
      },
    ]);
  }, [contextMenuItem]);

  // ── Logout handler ─────────────────────────────────────────
  const handleLogout = async () => {
    // Cleanup notifications before signing out
    if (userId) {
      unregisterPushToken(userId);
    }
    dismissCalorieNotification();

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
      console.log("[Chat] bubbleQueue empty, pendingDietPlan:", !!pendingDietPlanRef.current);
      if (pendingDietPlanRef.current) {
        console.log("[Chat] Adding diet card to listData");
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
    setShowWelcomeScreen(false);
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

      console.log("[Chat] response.dietPlan:", !!response.dietPlan, "bubbles:", response.bubbles?.length, "dietPlanShownRef:", dietPlanShownRef.current);
      if (response.dietPlan) {
        console.log("[Chat] Setting pendingDietPlan, days:", response.dietPlan.days?.length);
        pendingDietPlanRef.current = response.dietPlan;
        markDietPlanShown(conversationIdRef.current);
      }

      // Auto-log food if intent was detected
      if (response.foodLogResult) {
        try {
          await saveFoodLog(userId, response.foodLogResult);
          setShowDashboardToast(true);
          setTimeout(() => setShowDashboardToast(false), 2500);
          const cardContent = `${FOOD_LOG_PREFIX}${JSON.stringify(response.foodLogResult)}`;
          const foodCardId = Crypto.randomUUID();
          const foodCardMsg: DisplayMessage = {
            id: foodCardId,
            role: "assistant",
            content: cardContent,
            created_at: new Date().toISOString(),
          };
          // Queue the food card to show after text bubbles
          const originalBubbles = [...response.bubbles];
          bubbleQueueRef.current = originalBubbles;
          isProcessingBubblesRef.current = false;
          // We'll append the food card after all bubbles process
          const waitForBubbles = () => {
            if (bubbleQueueRef.current.length === 0 && !isProcessingBubblesRef.current) {
              setMessages((prev) => [...prev, foodCardMsg]);
              saveMessage("assistant", cardContent, foodCardId);
              scrollToEnd();
            } else {
              setTimeout(waitForBubbles, 300);
            }
          };
          processBubbleQueue();
          setTimeout(waitForBubbles, 500);
        } catch {
          // Food log save failed, still show text response
          bubbleQueueRef.current = [...response.bubbles];
          isProcessingBubblesRef.current = false;
          processBubbleQueue();
        }
      } else {
        bubbleQueueRef.current = [...response.bubbles];
        isProcessingBubblesRef.current = false;
        processBubbleQueue();
      }
    } catch {
      setShowTypingIndicator(false);
      setIsLoading(false);
      const errMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "Looks like there's a connection issue. Check your internet and try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  // ── Quick action handlers ──────────────────────────────────
  const handleQuickAction = (label: string) => {
    switch (label) {
      case "Diet Plan": {
        const dietIndex = listData.findIndex((item) => isDietCard(item));
        if (dietIndex >= 0) {
          flatListRef.current?.scrollToIndex({ index: dietIndex, animated: true, viewPosition: 0.3 });
        } else {
          handleSend("give me a diet plan");
        }
        break;
      }
      case "Log Food":
        setShowWaterPrompt(false);
        setShowFoodPrompt(false);
        setShowFoodLogModal(true);
        break;
      case "Connectors":
        router.push("/(main)/connectors");
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
      setShowDashboardToast(true);
      setTimeout(() => setShowDashboardToast(false), 2500);

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
        content: "Couldn't analyze that food. Try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFoodAnalyzed = async (result: FoodAnalysisResult, imageUri?: string) => {
    try {
      setShowWelcomeScreen(false);
      setIsLoading(true);
      setShowTypingIndicator(true);
      forceScrollToEnd();

      await saveFoodLog(userId, result, imageUri);
      setShowDashboardToast(true);
      setTimeout(() => setShowDashboardToast(false), 2500);

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
        content: "Couldn't save that food log. Try again?",
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

  // ── Inline voice chat hook ──────────────────────────────────
  const voiceChat = useVoiceChat({
    userId,
    conversationId: conversationIdRef.current,
    messageHistory: messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    dietPlanAlreadyShown: dietPlanShownRef.current,
    onNewMessages: handleVoiceMessages,
  });

  const startVoiceMode = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Microphone access is required for voice mode.");
      return;
    }
    setIsVoiceMode(true);
    voiceChat.start();
  }, [voiceChat]);

  const endVoiceMode = useCallback(() => {
    voiceChat.end();
    setIsVoiceMode(false);
  }, [voiceChat]);

  // ── Voice note (tap-to-record in input bar) ───────────────
  const startVoiceNoteRecording = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Microphone access is required for voice notes.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await voiceNoteRecorder.prepareToRecordAsync();
    voiceNoteRecorder.record();
    setIsRecordingVoiceNote(true);
  }, [voiceNoteRecorder]);

  const stopVoiceNoteAndSend = useCallback(async () => {
    setIsRecordingVoiceNote(false);
    setIsTranscribingNote(true);
    try {
      await voiceNoteRecorder.stop();
      const uri = voiceNoteRecorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!uri) {
        setIsTranscribingNote(false);
        return;
      }
      const text = await speechToText(uri);
      setIsTranscribingNote(false);
      if (text.trim()) {
        handleSend(text.trim());
      }
    } catch (e) {
      console.error("[VoiceNote] Error:", e);
      setIsTranscribingNote(false);
      Alert.alert("Voice note failed", "Could not transcribe your voice note. Please try again.");
    }
  }, [voiceNoteRecorder, handleSend]);

  const toggleVoiceNote = useCallback(() => {
    if (isRecordingVoiceNote) {
      stopVoiceNoteAndSend();
    } else {
      startVoiceNoteRecording();
    }
  }, [isRecordingVoiceNote, stopVoiceNoteAndSend, startVoiceNoteRecording]);

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
    <View style={{ flex: 1, backgroundColor: showWelcomeScreen ? (mode === "dark" ? "#060607" : "#f4f1ec") : colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 6,
            paddingHorizontal: 22,
            paddingBottom: 12,
            backgroundColor: showWelcomeScreen
              ? (mode === "dark" ? "#060607" : "#f4f1ec")
              : colors.headerBg,
            shadowColor: showWelcomeScreen ? "transparent" : "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: showWelcomeScreen ? 0 : (mode === "dark" ? 0.3 : 0.08),
            shadowRadius: 6,
            elevation: showWelcomeScreen ? 0 : 4,
            zIndex: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={() => setSidebarOpen(true)}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.5 : 1,
              })}
            >
              {/* Two-line menu */}
              <View style={{ gap: 3.5 }}>
                <View style={{ width: 18, height: 1.5, borderRadius: 2, backgroundColor: mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(12,10,8,0.45)" }} />
                <View style={{ width: 12, height: 1.5, borderRadius: 2, backgroundColor: mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(12,10,8,0.45)" }} />
              </View>
            </Pressable>

            <Pressable
              onPress={Keyboard.dismiss}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 17, color: mode === "dark" ? "#f5f5f0" : "#0c0a08", fontWeight: "400", letterSpacing: -0.2 }}>
                Nyra
              </Text>
            </Pressable>

            {/* Voice call toggle */}
            <Pressable
              onPress={isVoiceMode ? endVoiceMode : startVoiceMode}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.5 : 1,
                backgroundColor: isVoiceMode ? colors.accent + "20" : "transparent",
              })}
            >
              <Ionicons
                name={isVoiceMode ? "close" : "call-outline"}
                size={16}
                color={isVoiceMode ? colors.accent : (mode === "dark" ? "rgba(255,255,255,0.38)" : "rgba(12,10,8,0.3)")}/>
            </Pressable>
          </View>
        </View>

        {/* Pinned message banners */}
        {pinnedItems.length > 0 && (
          <PinnedBanner
            items={pinnedItems}
            onTap={handleScrollToPinned}
            onUnpin={handleUnpinMessage}
            colors={colors}
          />
        )}

        {/* Messages container */}
        <View style={{ flex: 1 }}>
          {showWelcomeScreen ? (
            <Pressable onPress={Keyboard.dismiss} style={{ flex: 1, backgroundColor: mode === "dark" ? "#060607" : "#f4f1ec" }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* ── Hero card ── */}
                <Animated.View
                  entering={FadeIn.duration(400)}
                  style={{
                    backgroundColor: mode === "dark" ? "#111210" : "#0c0a08",
                    borderRadius: 24,
                    margin: 14,
                    marginTop: 14,
                    paddingHorizontal: 20,
                    paddingTop: 22,
                    paddingBottom: 20,
                    overflow: "hidden",
                  }}
                >
                  {/* Glow */}
                  <View style={{
                    position: "absolute",
                    top: -50,
                    right: -50,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    backgroundColor: "rgba(190,241,53,0.18)",
                  }} />

                  <Text style={{ fontSize: 11, color: mode === "dark" ? "rgba(255,255,255,0.35)" : "rgba(244,241,236,0.38)", marginBottom: 5 }}>
                    Hi {profile?.name || "there"}
                  </Text>
                  <Text style={{
                    fontSize: 30,
                    fontWeight: "400",
                    color: mode === "dark" ? "#f5f5f0" : "#f4f1ec",
                    lineHeight: 33,
                    letterSpacing: -0.5,
                    marginBottom: 18,
                  }}>
                    Where should{"\n"}we <Text style={{ fontStyle: "italic", color: "#bef135" }}>start?</Text>
                  </Text>

                  {/* Pills */}
                  <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
                    {[
                      { key: "diet_plan", label: "Diet Plan", icon: "nutrition-outline" as const, active: true },
                      { key: "track_calories", label: "Calories", icon: "camera-outline" as const, active: false },
                      { key: "advice", label: "Health", icon: "heart-outline" as const, active: false },
                    ].map((pill, index) => (
                      <Animated.View key={pill.key} entering={FadeIn.duration(300).delay(100 + index * 80)}>
                        <Pressable onPress={() => handleWelcomeAction(pill.key)}>
                          <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            paddingHorizontal: 13,
                            paddingVertical: 7,
                            borderRadius: 100,
                            backgroundColor: pill.active ? "#bef135" : "rgba(255,255,255,0.07)",
                            borderWidth: pill.active ? 0 : 1,
                            borderColor: pill.active ? "transparent" : "rgba(255,255,255,0.07)",
                          }}>
                            <Ionicons
                              name={pill.icon}
                              size={11}
                              color={pill.active ? "#060607" : "rgba(255,255,255,0.55)"}
                            />
                            <Text style={{
                              fontSize: 12,
                              fontWeight: "500",
                              color: pill.active ? "#060607" : "rgba(255,255,255,0.55)",
                            }}>
                              {pill.label}
                            </Text>
                          </View>
                        </Pressable>
                      </Animated.View>
                    ))}
                  </View>
                </Animated.View>

                {/* ── Content area ── */}
                <View style={{ paddingHorizontal: 18 }}>
                  {/* Today's Overview header */}
                  <Animated.View entering={FadeIn.duration(400).delay(200)}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 14, paddingBottom: 10 }}>
                      <Text style={{
                        fontSize: 9,
                        fontWeight: "700",
                        letterSpacing: 1.8,
                        textTransform: "uppercase",
                        color: mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(12,10,8,0.3)",
                      }}>
                        Today's overview
                      </Text>
                      <Pressable onPress={() => router.push("/(main)/dashboard" as any)}>
                        <Text style={{
                          fontSize: 10,
                          color: mode === "dark" ? "#bef135" : "#5a8a00",
                          opacity: mode === "dark" ? 0.65 : 1,
                        }}>
                          see all →
                        </Text>
                      </Pressable>
                    </View>

                    {/* Stats inline */}
                    {(() => {
                      const summary = getDailySummary();
                      const calTarget = 2000;
                      const calPct = Math.min((summary.calories / calTarget) * 100, 100);
                      const stepPct = Math.min((steps / (stepGoal || 10000)) * 100, 100);
                      const waterPct = Math.min((waterGlasses / 8) * 100, 100);

                      return (
                        <View style={{ flexDirection: "row", paddingHorizontal: 4 }}>
                          {[
                            { val: summary.calories.toLocaleString(), unit: "cal", label: "Calories", pct: calPct },
                            { val: steps >= 1000 ? (steps / 1000).toFixed(1) : String(steps), unit: steps >= 1000 ? "k" : "", label: "Steps", pct: stepPct },
                            { val: String(waterGlasses), unit: "/8", label: "Water", pct: waterPct },
                          ].map((stat, i, arr) => (
                            <View
                              key={stat.label}
                              style={{
                                flex: 1,
                                paddingBottom: 14,
                                paddingLeft: i > 0 ? 14 : 0,
                                borderBottomWidth: 1,
                                borderBottomColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(12,10,8,0.07)",
                                borderRightWidth: i < arr.length - 1 ? 1 : 0,
                                borderRightColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(12,10,8,0.08)",
                              }}
                            >
                              <Text style={{
                                fontSize: 24,
                                fontWeight: "400",
                                color: mode === "dark" ? "rgba(255,255,255,0.88)" : "rgba(12,10,8,0.85)",
                                lineHeight: 24,
                                letterSpacing: -0.5,
                              }}>
                                {stat.val}
                                <Text style={{ fontSize: 10, fontWeight: "400", color: mode === "dark" ? "rgba(255,255,255,0.28)" : "rgba(12,10,8,0.3)" }}>
                                  {stat.unit}
                                </Text>
                              </Text>
                              <Text style={{ fontSize: 10, color: mode === "dark" ? "rgba(255,255,255,0.28)" : "rgba(12,10,8,0.35)", marginTop: 2 }}>
                                {stat.label}
                              </Text>
                              <View style={{
                                height: 2,
                                backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(12,10,8,0.08)",
                                borderRadius: 2,
                                marginTop: 7,
                                overflow: "hidden",
                              }}>
                                <View style={{
                                  height: "100%",
                                  width: `${stat.pct}%`,
                                  backgroundColor: mode === "dark" ? "#bef135" : "#5a8a00",
                                  borderRadius: 2,
                                  opacity: mode === "dark" ? 0.7 : 0.8,
                                }} />
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </Animated.View>

                  {/* Suggested header */}
                  <Animated.View entering={FadeIn.duration(400).delay(350)}>
                    <View style={{ paddingHorizontal: 4, paddingTop: 14, paddingBottom: 10 }}>
                      <Text style={{
                        fontSize: 9,
                        fontWeight: "700",
                        letterSpacing: 1.8,
                        textTransform: "uppercase",
                        color: mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(12,10,8,0.3)",
                      }}>
                        Suggested
                      </Text>
                    </View>

                    {/* Action items */}
                    <View style={{ paddingHorizontal: 4 }}>
                      {[
                        { key: "diet_plan", title: "View today's meal plan", sub: "3 meals tailored for you", icon: "nutrition-outline" as const },
                        { key: "track_calories", title: "Log your last meal", sub: "Snap a photo to track instantly", icon: "camera-outline" as const },
                        { key: "advice", title: "Get health advice", sub: "Personalised to your history", icon: "heart-outline" as const },
                      ].map((action, i, arr) => (
                        <Animated.View key={action.key} entering={FadeIn.duration(300).delay(400 + i * 80)}>
                          <Pressable onPress={() => handleWelcomeAction(action.key)}>
                            <View style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 11,
                              paddingVertical: 11,
                              borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                              borderBottomColor: mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(12,10,8,0.06)",
                            }}>
                              <View style={{
                                width: 30,
                                height: 30,
                                borderRadius: 9,
                                backgroundColor: mode === "dark" ? "rgba(190,241,53,0.07)" : "rgba(90,138,0,0.08)",
                                borderWidth: 1,
                                borderColor: mode === "dark" ? "rgba(190,241,53,0.1)" : "rgba(90,138,0,0.12)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}>
                                <Ionicons name={action.icon} size={13} color={mode === "dark" ? "#bef135" : "#5a8a00"} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: "500", color: mode === "dark" ? "rgba(255,255,255,0.82)" : "rgba(12,10,8,0.8)", letterSpacing: -0.1 }}>
                                  {action.title}
                                </Text>
                                <Text style={{ fontSize: 10, color: mode === "dark" ? "rgba(255,255,255,0.28)" : "rgba(12,10,8,0.35)", marginTop: 1 }}>
                                  {action.sub}
                                </Text>
                              </View>
                              <View style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(12,10,8,0.05)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}>
                                <Ionicons name="chevron-forward" size={9} color={mode === "dark" ? "rgba(255,255,255,0.3)" : "rgba(12,10,8,0.25)"} />
                              </View>
                            </View>
                          </Pressable>
                        </Animated.View>
                      ))}
                    </View>
                  </Animated.View>
                </View>
              </ScrollView>
            </Pressable>
          ) : (
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
          )}
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
            paddingBottom: insets.bottom + 6,
            backgroundColor: showWelcomeScreen
              ? (mode === "dark" ? "#060607" : "#f4f1ec")
              : colors.bg,
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

          {/* Input — text mode */}
          {isVoiceMode ? null : (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 8,
            gap: 9,
            backgroundColor: showWelcomeScreen
              ? (mode === "dark" ? "#060607" : "#f4f1ec")
              : colors.bg,
          }}>
            {/* + circle button */}
            <Pressable
              onPress={() => setShowQuickActions(true)}
              hitSlop={4}
            >
              <View style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(12,10,8,0.06)",
                borderWidth: 1,
                borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(12,10,8,0.1)",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Ionicons name="add" size={16} color={mode === "dark" ? "rgba(255,255,255,0.4)" : "rgba(12,10,8,0.4)"} />
              </View>
            </Pressable>

            {/* Input pill */}
            <View style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: mode === "dark" ? "rgba(255,255,255,0.05)" : "#fff",
              borderRadius: 100,
              borderWidth: mode === "dark" ? 1 : 1.5,
              borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(12,10,8,0.1)",
              paddingLeft: 15,
              paddingRight: 5,
              height: 44,
              ...(mode === "light" ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 3,
              } : {}),
            }}>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder={isRecordingVoiceNote ? "Recording..." : isTranscribingNote ? "Transcribing..." : "Ask Nyra\u2026"}
                placeholderTextColor={mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(12,10,8,0.28)"}
                multiline
                maxLength={1000}
                editable={!isRecordingVoiceNote && !isTranscribingNote}
                style={{
                  flex: 1,
                  color: mode === "dark" ? "#f5f5f0" : "#0c0a08",
                  fontSize: 12,
                  paddingVertical: Platform.OS === "ios" ? 10 : 8,
                  maxHeight: 80,
                }}
                returnKeyType="default"
                blurOnSubmit={false}
              />

              {/* Mic */}
              <Pressable
                onPress={toggleVoiceNote}
                disabled={isTranscribingNote}
                hitSlop={4}
                style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}
              >
                {isTranscribingNote ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons
                    name={isRecordingVoiceNote ? "stop-circle" : "mic-outline"}
                    size={14}
                    color={isRecordingVoiceNote ? "#FF4444" : (mode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(12,10,8,0.22)")}
                  />
                )}
              </Pressable>

              {/* Send button */}
              {(() => {
                const hasText = !!input.trim() && !isLoading;
                return (
                  <Pressable
                    onPress={() => handleSend()}
                    disabled={!hasText}
                  >
                    <View style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: hasText
                        ? "#bef135"
                        : (mode === "dark" ? "#bef135" : "#0c0a08"),
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: hasText ? 1 : (mode === "dark" ? 1 : 1),
                    }}>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={mode === "dark" ? "#000" : (hasText ? "#000" : "#f4f1ec")}
                      />
                    </View>
                  </Pressable>
                );
              })()}
            </View>
          </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Context menu modal */}
      <ContextMenuModal
        visible={contextMenuVisible}
        onClose={() => setContextMenuVisible(false)}
        onReply={handleContextReply}
        onCopy={handleContextCopy}
        onPin={handleContextPin}
        onDelete={handleContextDelete}
        isPinned={contextMenuItem ? pinnedMessageIds.has(contextMenuItem.id) : false}
        menuY={contextMenuY}
        menuX={contextMenuX}
        isUserMessage={contextMenuItem?.role === "user"}
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
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={() => setShowQuickActions(false)}
        >
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: colors.cardBg,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                paddingBottom: insets.bottom + 16,
              }}
            >
              {/* Drag handle */}
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.textFaint + "50" }} />
              </View>

              {/* Title */}
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700", paddingHorizontal: 20, marginBottom: 16 }}>
                Tools
              </Text>

              {/* Options */}
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
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
                      backgroundColor: pressed ? colors.accent + "10" : colors.separator + "40",
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name={iconName} size={22} color={colors.accent} style={{ marginRight: 14 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                          {action.label}
                        </Text>
                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                          {desc}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </View>
                  </Pressable>
                );
              })}
              </View>

              {/* Cancel */}
              <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
                <Pressable
                  onPress={() => setShowQuickActions(false)}
                  style={({ pressed }) => ({
                    paddingVertical: 13,
                    alignItems: "center",
                    borderRadius: 12,
                    backgroundColor: pressed ? colors.separator : colors.separator + "60",
                  })}
                >
                  <Text style={{ color: colors.subText, fontSize: 15, fontWeight: "600" }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dashboard update toast */}
      {showDashboardToast && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            position: "absolute",
            top: insets.top + 60,
            alignSelf: "center",
            backgroundColor: colors.accent,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            zIndex: 999,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color="#0D0D0D" />
          <Text style={{ color: "#0D0D0D", fontSize: 13, fontWeight: "700" }}>
            Dashboard updated
          </Text>
        </Animated.View>
      )}

      {/* Sidebar overlay */}
      <ChatSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userId={userId}
        currentConversationId={conversationIdRef.current}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        profile={profile}
        session={session}
        onLogout={handleLogout}
      />

      {/* Voice call fullscreen overlay */}
      {isVoiceMode && (
        <VoiceInputBar
          state={voiceChat.state}
          transcript={voiceChat.transcript}
          onStop={voiceChat.stop}
          onEnd={endVoiceMode}
          accentColor={colors.accent}
          bgColor={colors.inputBg}
          textColor={colors.inputText}
          subTextColor={colors.inputPlaceholder}
        />
      )}

    </View>
  );
}
